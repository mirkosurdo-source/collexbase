import { connectDB } from "@/lib/db"
import Follow from "@/lib/models/Follow"
import { createNotification } from "@/lib/notifications"

/**
 * Blocco 25 — community notifications, all in the CollexSpark voice.
 *
 * These wrap the Blocco 20 createNotification helper (no model changes). They
 * are fire-and-forget: any failure is logged but never thrown, so callers in
 * existing routes are never broken by a notification problem.
 */

const SPARK = "⚡ CollexSpark"

/**
 * Notifies every follower of `authorId` that a new community entry was
 * published. Blog entries and plain posts get a slightly different message.
 */
export async function notifyFollowersOfNewPost(params: {
  authorId: string
  authorUsername: string
  postId: string
  kind: "post" | "blog"
  title?: string
  category?: string
}): Promise<void> {
  try {
    await connectDB()
    const { authorId, authorUsername, postId, kind, title, category } = params

    // Followers are stored as { followerId, sellerId } where sellerId is the
    // followed user. Reused as-is so the social graph stays unified.
    const follows = await Follow.find({ sellerId: authorId }).select("followerId").lean()
    if (!follows.length) return

    const who = authorUsername || "Un collezionista che segui"
    const link = `/community/${postId}`
    const title_ =
      kind === "blog"
        ? `${SPARK}: nuovo articolo da ${who}`
        : `${SPARK}: ${who} ha pubblicato un nuovo post!`
    const body =
      kind === "blog"
        ? `${title ? `"${title}"` : "Un nuovo articolo"}${category ? ` in ${category}` : ""} è ora disponibile nel blog della community.`
        : `Dai un'occhiata all'ultimo post${category ? ` su ${category}` : ""} nella community.`

    await Promise.all(
      follows.map((f: Record<string, unknown>) =>
        createNotification({
          userId: String(f.followerId),
          type: "system",
          title: title_,
          body,
          link,
        }),
      ),
    )
  } catch (error) {
    console.error("[v0] notifyFollowersOfNewPost error:", error)
  }
}

/** Notifies a user that someone started following them. */
export async function notifyNewFollower(params: {
  followedUserId: string
  followerUsername: string
}): Promise<void> {
  try {
    await createNotification({
      userId: params.followedUserId,
      type: "system",
      title: `${SPARK}: hai un nuovo follower!`,
      body: `${params.followerUsername || "Un collezionista"} ha iniziato a seguirti nella community.`,
      link: "/community",
    })
  } catch (error) {
    console.error("[v0] notifyNewFollower error:", error)
  }
}

/** Notifies the author when their post crosses a popularity milestone. */
export async function notifyPopularPost(params: {
  authorId: string
  postId: string
  likeCount: number
}): Promise<void> {
  try {
    await createNotification({
      userId: params.authorId,
      type: "system",
      title: `${SPARK}: il tuo post sta spopolando!`,
      body: `Il tuo post ha raggiunto ${params.likeCount} "mi piace" nella community. Continua così!`,
      link: `/community/${params.postId}`,
    })
  } catch (error) {
    console.error("[v0] notifyPopularPost error:", error)
  }
}
