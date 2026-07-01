/**
 * Blocco 29 — read-only chat activity aggregation for the advanced profile
 * and the badge engine. Operates entirely on the existing Blocco 19 chat
 * collections (ChatThread / ChatMessage) so nothing in the chat engine is
 * modified. Only the user's own private conversations are considered.
 */

import { connectDB } from "@/lib/db"
import ChatThread from "@/lib/models/ChatThread"
import ChatMessage from "@/lib/models/ChatMessage"
import User from "@/lib/models/User"

export interface ChatStats {
  /** Number of private conversations the user participates in. */
  conversations: number
  /** Total chat messages the user has sent (all thread types). */
  messagesSent: number
}

export interface ContactedUser {
  userId: string
  username: string
  avatar: string
  messages: number
}

export interface ChatActivity extends ChatStats {
  mostContacted: ContactedUser[]
  advice: { pose: string; message: string }[]
}

/** Lightweight counts used by the badge engine (conversatore / socialStar). */
export async function gatherChatStats(userId: string): Promise<ChatStats> {
  await connectDB()
  const [conversations, messagesSent] = await Promise.all([
    ChatThread.countDocuments({ type: "private", participants: userId }),
    ChatMessage.countDocuments({ senderId: userId, deleted: { $ne: true } }),
  ])
  return { conversations, messagesSent }
}

/** Full chat activity block for the "Attività Chat" profile section. */
export async function gatherChatActivity(userId: string): Promise<ChatActivity> {
  await connectDB()

  const [stats, privateThreads] = await Promise.all([
    gatherChatStats(userId),
    ChatThread.find({ type: "private", participants: userId })
      .select("participants")
      .sort({ lastMessageAt: -1 })
      .limit(50)
      .lean<{ participants: string[] }[]>(),
  ])

  // Tally messages sent by this user per counterpart, to find the most-contacted.
  const counterpartIds = Array.from(
    new Set(
      privateThreads
        .map((t) => (t.participants || []).find((p) => p !== userId))
        .filter((v): v is string => !!v),
    ),
  )

  let mostContacted: ContactedUser[] = []
  if (counterpartIds.length > 0) {
    // Count this user's messages grouped by the threads they share with each counterpart.
    const threads = await ChatThread.find({ type: "private", participants: userId })
      .select("_id participants")
      .lean<{ _id: unknown; participants: string[] }[]>()

    const threadToCounterpart = new Map<string, string>()
    for (const t of threads) {
      const other = (t.participants || []).find((p) => p !== userId)
      if (other) threadToCounterpart.set(String(t._id), other)
    }

    const perThread = await ChatMessage.aggregate<{ _id: string; count: number }>([
      { $match: { senderId: userId, deleted: { $ne: true }, threadId: { $in: Array.from(threadToCounterpart.keys()) } } },
      { $group: { _id: "$threadId", count: { $sum: 1 } } },
    ])

    const perCounterpart = new Map<string, number>()
    for (const row of perThread) {
      const cp = threadToCounterpart.get(String(row._id))
      if (cp) perCounterpart.set(cp, (perCounterpart.get(cp) ?? 0) + row.count)
    }

    const topIds = Array.from(perCounterpart.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const users = await User.find({ _id: { $in: topIds.map((t) => t[0]) } })
      .select("username avatar")
      .lean<{ _id: unknown; username: string; avatar?: string }[]>()
    const byId = new Map(users.map((u) => [String(u._id), u]))

    mostContacted = topIds
      .map(([id, messages]) => {
        const u = byId.get(id)
        if (!u) return null
        return { userId: id, username: u.username, avatar: u.avatar || "", messages }
      })
      .filter((v): v is ContactedUser => v !== null)
  }

  return { ...stats, mostContacted, advice: buildChatAdvice(stats) }
}

/** CollexSpark social tips derived from chat activity (presentational only). */
export function buildChatAdvice(stats: ChatStats): { pose: string; message: string }[] {
  const tips: { pose: string; message: string }[] = []
  if (stats.conversations === 0) {
    tips.push({ pose: "happy", message: "Avvia la tua prima conversazione per sbloccare il badge Conversatore!" })
  } else if (stats.conversations < 10) {
    tips.push({ pose: "happy", message: `Ti mancano ${10 - stats.conversations} conversazioni per il badge Conversatore Silver.` })
  }
  if (stats.messagesSent > 0 && stats.messagesSent < 100) {
    tips.push({ pose: "trend", message: `${100 - stats.messagesSent} messaggi al badge Social Star.` })
  }
  if (!tips.length) {
    tips.push({ pose: "deal", message: "Sei molto attivo in chat! Ricorda di restare cortese e affidabile." })
  }
  return tips.slice(0, 2)
}
