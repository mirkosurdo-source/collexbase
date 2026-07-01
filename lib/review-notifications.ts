/**
 * Blocco 28 — review notifications in the CollexSpark voice.
 *
 * Fire-and-forget helpers triggered when a review is created. They never throw;
 * createNotification already swallows its own errors. Badge/level-up
 * notifications continue to be handled by syncProfileProgress (Blocco 27).
 */

import { createNotification } from "@/lib/notifications"

const SPARK = "⚡ CollexSpark"

/** A user received a new review. */
export async function notifyNewReview(opts: {
  targetUserId: string
  targetUsername: string
  authorUsername: string
  rating: number
}) {
  await createNotification({
    userId: opts.targetUserId,
    type: "system",
    title: "⚡ Hai ricevuto una nuova recensione!",
    body: `${opts.authorUsername || "Un utente"} ti ha valutato ${opts.rating}/5.`,
    link: `/reviews/${opts.targetUsername}`,
  })
}

/** The user's average rating increased after the new review. */
export async function notifyAvgIncreased(opts: {
  targetUserId: string
  targetUsername: string
  newAvg: number
}) {
  await createNotification({
    userId: opts.targetUserId,
    type: "system",
    title: "⚡ La tua media voto è aumentata!",
    body: `La tua valutazione media è salita a ${opts.newAvg}/5. Ottimo lavoro!`,
    link: `/reviews/${opts.targetUsername}`,
  })
}

/** The user just crossed a "trusted" threshold for a given context. */
export async function notifyTrustEarned(opts: {
  targetUserId: string
  targetUsername: string
  label: string
}) {
  await createNotification({
    userId: opts.targetUserId,
    type: "system",
    title: `${SPARK}: ${opts.label}!`,
    body: "Hai raggiunto un livello di affidabilità elevato. I collezionisti si fidano di te!",
    link: `/reviews/${opts.targetUsername}`,
  })
}
