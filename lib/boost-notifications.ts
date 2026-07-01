import { createNotification } from "@/lib/notifications"
import type { BoostTargetType, BoostTier } from "@/lib/models/BoostActivation"
import { BOOST_EFFECTS } from "@/lib/boost"

const TARGET_PATH: Record<BoostTargetType, string> = {
  marketplace: "/marketplace",
  auction: "/auctions",
  trade: "/trades",
  showcase: "/showcase",
}

/** ⚡ Boost successfully activated. */
export async function notifyBoostActivated(
  userId: string,
  targetType: BoostTargetType,
  tier: BoostTier,
  endsAt: Date,
) {
  const effect = BOOST_EFFECTS[tier]
  await createNotification({
    userId,
    type: "system",
    title: "⚡ Boost attivato!",
    body: `${effect.label} attivo (+${effect.visibilityPct}% visibilità) fino al ${endsAt.toLocaleDateString("it-IT")}.`,
    link: TARGET_PATH[targetType],
  })
}

/** ⚡ Reminder that an Ultra boost is about to expire. */
export async function notifyBoostExpiring(userId: string, targetType: BoostTargetType, tier: BoostTier) {
  const effect = BOOST_EFFECTS[tier]
  await createNotification({
    userId,
    type: "system",
    title: "⚡ Boost in scadenza",
    body: `Il tuo ${effect.label} scade tra meno di 24h. Rinnova per restare in evidenza.`,
    link: TARGET_PATH[targetType],
  })
}

/** ⚡ Advisor hint suggesting a boost on a high-potential item. */
export async function notifyBoostSuggestion(userId: string, title: string) {
  await createNotification({
    userId,
    type: "system",
    title: "⚡ Opportunità di Boost",
    body: `"${title}" ha alta probabilità di successo: valuta un Boost per massimizzare la visibilità.`,
    link: "/advisor",
  })
}
