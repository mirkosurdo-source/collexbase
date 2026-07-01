/**
 * Blocco 32 — CollexSpark-styled notifications for showcase events.
 *
 * Thin, fire-and-forget wrappers around createNotification. They never throw,
 * so they can be safely called from API routes without affecting the main flow.
 */
import { createNotification } from "@/lib/notifications"

const showcaseLink = (username: string) => `/showcase/${username}`

/** A user gained a new showcase follower. */
export async function notifyShowcaseFollower(ownerId: string, ownerUsername: string, byUsername: string) {
  await createNotification({
    userId: ownerId,
    type: "system",
    title: "⚡ La tua vetrina ha un nuovo follower!",
    body: `${byUsername || "Un collezionista"} ha iniziato a seguire la tua vetrina.`,
    link: showcaseLink(ownerUsername),
  })
}

/** A user earned a showcase badge. */
export async function notifyShowcaseBadge(userId: string, username: string, label: string) {
  await createNotification({
    userId,
    type: "system",
    title: "⚡ Hai guadagnato un badge vetrina!",
    body: `Hai sbloccato il badge "${label}". Continua così!`,
    link: showcaseLink(username),
  })
}

/** The showcase is gaining traction (growth nudge). */
export async function notifyShowcaseGrowing(userId: string, username: string, followers: number) {
  await createNotification({
    userId,
    type: "system",
    title: "⚡ CollexSpark: la tua vetrina sta crescendo!",
    body: `La tua vetrina ha raggiunto ${followers} follower. Aggiungi nuovi pezzi in evidenza!`,
    link: showcaseLink(username),
  })
}

/** The showcase was shared somewhere (community, blog, group). */
export async function notifyShowcaseShared(ownerId: string, ownerUsername: string, where: string) {
  await createNotification({
    userId: ownerId,
    type: "system",
    title: "⚡ La tua vetrina è stata condivisa!",
    body: `La tua vetrina è stata condivisa ${where}.`,
    link: showcaseLink(ownerUsername),
  })
}

/** A user was invited to view someone's showcase. */
export async function notifyShowcaseInvite(targetId: string, ownerUsername: string, byUsername: string) {
  await createNotification({
    userId: targetId,
    type: "system",
    title: "⚡ Sei stato invitato a una vetrina!",
    body: `${byUsername || "Un collezionista"} ti ha invitato a vedere la sua vetrina.`,
    link: showcaseLink(ownerUsername),
  })
}

/** A new marketplace/trade/auction opportunity derived from the showcase. */
export async function notifyShowcaseOpportunity(userId: string, username: string, message: string) {
  await createNotification({
    userId,
    type: "system",
    title: "⚡ Nuova opportunità basata sulla tua vetrina!",
    body: message,
    link: showcaseLink(username),
  })
}
