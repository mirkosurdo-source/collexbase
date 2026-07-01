import { createNotification } from "@/lib/notifications"
import type { PlanId } from "@/lib/subscription"

/**
 * Blocco 23 — CollexSpark notifications for coin store purchases.
 *
 * Wraps the Blocco 20 createNotification helper (no model changes). Fire-and-
 * forget: failures are swallowed inside createNotification.
 */
export async function notifyCoinsPurchase(opts: {
  userId: string
  coins: number
  savings: number
  tier: PlanId
}): Promise<void> {
  const { userId, coins, savings, tier } = opts
  const coinsLabel = coins.toLocaleString("it-IT")
  const savingsLabel = savings.toLocaleString("it-IT", { style: "currency", currency: "EUR" })

  const lines: string[] = [`Monete aggiunte al tuo wallet!`]
  if (savings > 0) lines.push(`Risparmio totale: ${savingsLabel}.`)
  if (tier !== "Base") lines.push(`Bonus ${tier} applicato!`)

  await createNotification({
    userId,
    type: "payment",
    title: `CollexSpark: hai acquistato ${coinsLabel} CollexCoins!`,
    body: lines.join(" "),
    link: "/wallet",
  })
}
