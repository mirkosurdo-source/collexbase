/**
 * Blocco 30 — CollexSpark-styled notifications for group events.
 *
 * Thin, fire-and-forget wrappers around createNotification. Never throw, so
 * they can be safely called from API routes without affecting the main flow.
 * Group notifications deep-link to /groups/[id] via an explicit link.
 */
import { connectDB } from "@/lib/db"
import GroupMember from "@/lib/models/GroupMember"
import { createNotification } from "@/lib/notifications"

const groupLink = (groupId: string) => `/groups/${groupId}`

/** Notifies all group members (except the actor) that a new post was published. */
export async function notifyGroupPost(groupId: string, groupName: string, actorId: string, preview: string) {
  try {
    await connectDB()
    const members = await GroupMember.find({ groupId, userId: { $ne: actorId } })
      .select("userId")
      .lean()
    await Promise.all(
      members.map((m: Record<string, unknown>) =>
        createNotification({
          userId: String(m.userId),
          type: "system",
          title: `⚡ Nuovo post in ${groupName}`,
          body: preview.slice(0, 120),
          link: groupLink(groupId),
        }),
      ),
    )
  } catch (error) {
    console.error("[v0] notifyGroupPost error:", error)
  }
}

/** Notifies all members about a new group-internal auction or trade. */
export async function notifyGroupListing(
  groupId: string,
  groupName: string,
  actorId: string,
  kind: "auction" | "trade",
  itemName: string,
) {
  try {
    await connectDB()
    const members = await GroupMember.find({ groupId, userId: { $ne: actorId } })
      .select("userId")
      .lean()
    const title = kind === "auction" ? `⚡ Nuova asta in ${groupName}` : `⚡ Nuovo scambio in ${groupName}`
    await Promise.all(
      members.map((m: Record<string, unknown>) =>
        createNotification({ userId: String(m.userId), type: "system", title, body: itemName, link: groupLink(groupId) }),
      ),
    )
  } catch (error) {
    console.error("[v0] notifyGroupListing error:", error)
  }
}

/** Notifies a user they were invited to a group. */
export async function notifyGroupInvite(invitedUserId: string, groupId: string, groupName: string, byUsername: string) {
  await createNotification({
    userId: invitedUserId,
    type: "system",
    title: "⚡ Sei stato invitato a un gruppo!",
    body: `${byUsername || "Un collezionista"} ti ha invitato in ${groupName}.`,
    link: groupLink(groupId),
  })
}

/** Notifies a user they earned a group-related badge. */
export async function notifyGroupBadge(userId: string, label: string) {
  await createNotification({
    userId,
    type: "system",
    title: "⚡ Nuovo badge di gruppo!",
    body: `Hai sbloccato il badge "${label}". Complimenti!`,
    link: "/profile",
  })
}
