/**
 * Blocco 37 — moderation notifications in the CollexSpark "Moderatore" voice.
 *
 * Fire-and-forget helpers. They never throw (createNotification swallows its
 * own errors) and reuse the unified "moderation" notification type added in
 * Blocco 20. Fully additive: no existing notification flow is modified.
 */

import { createNotification } from "@/lib/notifications"

const SPARK = "⚡ CollexSpark Moderatore"

/** A user's content was hidden/removed or flagged by automatic moderation. */
export async function notifyContentModerated(
  userId: string,
  targetType: string,
  reason: string,
  removed?: boolean,
) {
  await createNotification({
    userId,
    type: "moderation",
    title: removed ? "⚠ Contenuto rimosso automaticamente" : "⚠ Un tuo contenuto è stato segnalato",
    body: reason || `${SPARK}: un tuo ${targetType} non rispetta le regole della community.`,
    link: "/moderation/regole",
  })
}

/** A user's marketplace listing was flagged. */
export async function notifyListingFlagged(userId: string, listingId: string, reason: string) {
  await createNotification({
    userId,
    type: "moderation",
    title: "⚠ Il tuo annuncio è stato segnalato",
    body: reason || `${SPARK}: il tuo annuncio è in revisione per un possibile rischio.`,
    link: listingId ? `/market/item/${listingId}` : "/moderation/regole",
  })
}

/** Warn a user that a trade they are involved in looks risky. */
export async function notifyRiskyTrade(userId: string, tradeId: string) {
  await createNotification({
    userId,
    type: "moderation",
    title: "⚠ Scambio a rischio",
    body: `${SPARK}: attenzione, questo scambio sembra rischioso.`,
    link: tradeId ? `/trades/${tradeId}` : "/moderation/regole",
  })
}

/** A post/comment was hidden by moderation. */
export async function notifyPostHidden(userId: string, reason: string) {
  await createNotification({
    userId,
    type: "moderation",
    title: "⚠ Moderazione: un tuo post è stato nascosto",
    body: reason || `${SPARK}: il tuo post è stato nascosto perché non conforme alle regole.`,
    link: "/moderation/regole",
  })
}
