import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"
import GroupMember from "@/lib/models/GroupMember"
import { getAuthUserId } from "@/lib/auth/request"
import { getAuthor } from "@/lib/community"
import { recommendGroups, getRolesForUser, toGroupDTO } from "@/lib/groups"

const PAGE_SIZE = 12

/** GET /api/groups — discovery feeds: recommended | popular | new | category. */
export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const feed = searchParams.get("feed") || "popular"
    const category = searchParams.get("category") || ""
    const q = searchParams.get("q") || ""
    const page = Math.max(1, Number(searchParams.get("page")) || 1)
    const userId = getAuthUserId(req)

    if (feed === "recommended") {
      const groups = await recommendGroups(userId, 8)
      return NextResponse.json({ success: true, groups })
    }

    const filter: Record<string, unknown> = { status: "active" }
    // Private groups are hidden from discovery unless official.
    filter.$or = [{ privacy: "public" }, { official: true }]
    if (category) filter.category = category
    if (q) filter.name = { $regex: q, $options: "i" }

    const sort: Record<string, 1 | -1> = feed === "new" ? { createdAt: -1 } : { memberCount: -1, lastActivityAt: -1 }

    const total = await Group.countDocuments(filter)
    const docs = await Group.find(filter)
      .sort(sort)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean()

    const roles = await getRolesForUser(
      docs.map((d: Record<string, unknown>) => String(d._id)),
      userId,
    )
    const groups = docs.map((d: Record<string, unknown>) => toGroupDTO(d, roles[String(d._id)] ?? null))

    return NextResponse.json({
      success: true,
      groups,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    })
  } catch (error) {
    console.error("[v0] groups list error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

/** POST /api/groups — create a new group (creator becomes owner + member). */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const name = String(body.name || "").trim()
    if (name.length < 3) {
      return NextResponse.json({ success: false, message: "Il nome deve avere almeno 3 caratteri." }, { status: 400 })
    }

    await connectDB()
    const author = await getAuthor(userId)

    const group = await Group.create({
      name,
      description: String(body.description || "").trim(),
      image: String(body.image || body.coverImage || ""),
      category: String(body.category || "").trim(),
      privacy: body.privacy === "private" ? "private" : "public",
      language: String(body.language || "it"),
      ownerId: userId,
      adminIds: [userId],
      memberCount: 1,
    })

    await GroupMember.create({
      groupId: group._id,
      userId,
      role: "owner",
      username: author?.username || "",
      avatar: author?.avatar || "",
    })

    return NextResponse.json({ success: true, group: toGroupDTO(group.toObject(), "owner") })
  } catch (error) {
    console.error("[v0] groups create error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
