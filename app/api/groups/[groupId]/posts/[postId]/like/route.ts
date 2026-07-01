import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import GroupPost from "@/lib/models/GroupPost"
import GroupMember from "@/lib/models/GroupMember"
import { getAuthUserId } from "@/lib/auth/request"

/** POST /api/groups/[groupId]/posts/[postId]/like — toggle a like (members only). */
export async function POST(req: Request, { params }: { params: Promise<{ groupId: string; postId: string }> }) {
  try {
    const { groupId, postId } = await params
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    await connectDB()
    const membership = await GroupMember.findOne({ groupId, userId }).select("_id").lean()
    if (!membership) return NextResponse.json({ success: false, message: "Solo i membri." }, { status: 403 })

    const post = await GroupPost.findOne({ _id: postId, groupId })
    if (!post) return NextResponse.json({ success: false, message: "Post non trovato." }, { status: 404 })

    const likes: string[] = post.likes || []
    const liked = likes.includes(userId)
    if (liked) {
      post.likes = likes.filter((l) => l !== userId)
    } else {
      post.likes = [...likes, userId]
    }
    post.likeCount = post.likes.length
    await post.save()

    return NextResponse.json({ success: true, liked: !liked, likeCount: post.likeCount })
  } catch (error) {
    console.error("[v0] group post like error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
