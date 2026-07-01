import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Group from "@/lib/models/Group"
import GroupMember from "@/lib/models/GroupMember"
import GroupMessage from "@/lib/models/GroupMessage"
import { getAuthUserId } from "@/lib/auth/request"
import { getAuthor } from "@/lib/community"

/** GET /api/groups/[groupId]/messages — recent group chat messages (members only). */
export async function GET(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    await connectDB()
    const membership = await GroupMember.findOne({ groupId, userId }).select("_id").lean()
    if (!membership) return NextResponse.json({ success: false, message: "Solo i membri.", restricted: true }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit")) || 60))

    const docs = await GroupMessage.find({ groupId }).sort({ createdAt: -1 }).limit(limit).lean()
    const messages = docs
      .reverse()
      .map((m: Record<string, unknown>) => ({
        id: String(m._id),
        senderId: String(m.senderId),
        senderUsername: String(m.senderUsername || ""),
        senderAvatar: String(m.senderAvatar || ""),
        text: String(m.text || ""),
        image: String(m.image || ""),
        mine: String(m.senderId) === userId,
        createdAt: m.createdAt,
      }))

    return NextResponse.json({ success: true, messages })
  } catch (error) {
    console.error("[v0] group messages list error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}

/** POST /api/groups/[groupId]/messages — send a group chat message (members only). */
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    await connectDB()
    const membership = await GroupMember.findOne({ groupId, userId })
    if (!membership) return NextResponse.json({ success: false, message: "Solo i membri." }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const text = String(body.text || "").trim()
    const image = String(body.image || "")
    if (!text && !image) return NextResponse.json({ success: false, message: "Messaggio vuoto." }, { status: 400 })

    const author = await getAuthor(userId)
    const message = await GroupMessage.create({
      groupId,
      senderId: userId,
      senderUsername: author?.username || "",
      senderAvatar: author?.avatar || "",
      text,
      image,
    })

    await Promise.all([
      Group.updateOne({ _id: groupId }, { $inc: { messageCount: 1 }, $set: { lastActivityAt: new Date() } }),
      GroupMember.updateOne({ _id: membership._id }, { $inc: { messageCount: 1 } }),
    ])

    return NextResponse.json({
      success: true,
      message: {
        id: String(message._id),
        senderId: userId,
        senderUsername: author?.username || "",
        senderAvatar: author?.avatar || "",
        text,
        image,
        mine: true,
        createdAt: message.createdAt,
      },
    })
  } catch (error) {
    console.error("[v0] group message create error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
