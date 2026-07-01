import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { createNotification } from "@/lib/notifications"

export interface Author {
  id: string
  username: string
  avatar: string
  name: string
}

/** Loads a minimal author identity for a user id, or null if not found. */
export async function getAuthor(userId: string): Promise<Author | null> {
  await connectDB()
  const user = await User.findById(userId).select("username avatar name").lean()
  if (!user) return null
  const u = user as Record<string, unknown>
  return {
    id: String(u._id),
    username: String(u.username || ""),
    avatar: String(u.avatar || ""),
    name: String(u.name || ""),
  }
}

/** Extracts @username mentions from a body of text (unique, lowercased-safe). */
export function parseMentions(text: string): string[] {
  const found = new Set<string>()
  const re = /@([a-zA-Z0-9_.-]{2,30})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    found.add(m[1])
  }
  return Array.from(found)
}

/** Notifies any mentioned users (by username) that they were tagged. */
export async function notifyMentions(usernames: string[], actor: Author, link: string): Promise<void> {
  if (!usernames.length) return
  try {
    await connectDB()
    const users = await User.find({ username: { $in: usernames } })
      .select("_id")
      .lean()
    await Promise.all(
      users.map((u: Record<string, unknown>) => {
        if (String(u._id) === actor.id) return Promise.resolve()
        return createNotification({
          userId: String(u._id),
          type: "system",
          title: "Sei stato menzionato",
          body: `${actor.username || "Un utente"} ti ha menzionato in un commento.`,
          link,
        })
      }),
    )
  } catch (error) {
    console.error("[v0] notifyMentions error:", error)
  }
}
