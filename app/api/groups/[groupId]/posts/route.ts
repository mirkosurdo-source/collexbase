import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"
import GroupMember from "@/lib/models/GroupMember"
import GroupPost from "@/lib/models/GroupPost"
import { getAuthUserId } from "@/lib/auth/request"
import { getAuthor } from "@/lib/community"
import { getRole, toGroupDTO, canView } from "@/lib/groups"
import { notifyGroupPost, notifyGroupListing } from "@/lib/group-notifications"

const PAGE_SIZE = 15

/** GET /api/groups/[groupId]/posts — group feed (optionally filtered by type). */
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    await connectDB()
    const userId = getAuthUserId(req)
    const { searchParams } = new URL(req.url)
    const postType = searchParams.get("type") || ""
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const groupDoc = await Group.findById(groupId).lean()
    if (!groupDoc) return NextResponse.json({ success: false, message: "Gruppo non trovato." }, { status: 404 })

    const role = await getRole(groupId, userId)
    if (!canView(toGroupDTO(groupDoc as Record<string, unknown>, role))) {
      return NextResponse.json({ success: true, posts: [], restricted: true })
    }

    const filter: Record<string, unknown> = { groupId }
    if (postType === "trade" || postType === "auction" || postType === "discussion") filter.postType = postType

    const docs = await GroupPost.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean()

    const posts = docs.map((p: Record<string, unknown>) => {
      const likes = (p.likes as string[]) || []
      return {
        id: String(p._id),
        authorId: String(p.authorId),
        authorUsername: String(p.authorUsername || ""),
        authorAvatar: String(p.authorAvatar || ""),
        postType: String(p.postType || "discussion"),
        body: String(p.body || ""),
        images: (p.images as string[]) || [],
        itemName: String(p.itemName || ""),
        price: Number(p.price || 0),
        likeCount: Number(p.likeCount || 0),
        commentCount: Number(p.commentCount || 0),
        liked: userId ? likes.includes(userId) : false,
        isOwner: userId ? String(p.authorId) === userId : false,
        createdAt: p.createdAt,
      }
    })

    return NextResponse.json({ success: true, posts })
  } catch (error) {
    console.error("[v0] group posts list error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

/** POST /api/groups/[groupId]/posts — publish a post (members only). */
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    await connectDB()
    const membership = await GroupMember.findOne({ groupId, userId })
    if (!membership) {
      return NextResponse.json({ success: false, message: "Solo i membri possono pubblicare." }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const text = String(body.body || "").trim()
    const postType = ["discussion", "trade", "auction"].includes(body.postType) ? body.postType : "discussion"
    const images = Array.isArray(body.images) ? body.images.slice(0, 6).map(String) : []
    if (!text && images.length === 0) {
      return NextResponse.json({ success: false, message: "Il post è vuoto." }, { status: 400 })
    }

    const group = await Group.findById(groupId).select("name").lean<{ name?: string } | null>()
    const author = await getAuthor(userId)

    const post = await GroupPost.create({
      groupId,
      authorId: userId,
      authorUsername: author?.username || "",
      authorAvatar: author?.avatar || "",
      postType,
      body: text,
      images,
      itemName: String(body.itemName || ""),
      price: Number(body.price || 0),
    })

    // Update denormalized counters.
    await Promise.all([
      Group.updateOne({ _id: groupId }, { $inc: { postCount: 1 }, $set: { lastActivityAt: new Date() } }),
      GroupMember.updateOne({ _id: membership._id }, { $inc: { postCount: 1 } }),
    ])

    // CollexSpark notifications (fire-and-forget).
    const groupName = group?.name || "il gruppo"
    if (postType === "discussion") {
      void notifyGroupPost(groupId, groupName, userId, text || "Nuovo contenuto")
    } else {
      void notifyGroupListing(groupId, groupName, userId, postType, String(body.itemName || text).slice(0, 80))
    }

    return NextResponse.json({ success: true, post: { id: String(post._id) } })
  } catch (error) {
    console.error("[v0] group post create error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
