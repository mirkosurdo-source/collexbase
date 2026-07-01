/**
 * Blocco 43 — Live Trade server helpers (participant checks, confirmation
 * reset for anti-scam, and lazy expiry since there is no scheduler).
 */

export interface LiveTradeDoc {
  _id: unknown
  userA: string
  userB: string
  status: string
  confirmedA: boolean
  confirmedB: boolean
  expiresAt: Date
  chat: Array<Record<string, unknown>>
  save: () => Promise<unknown>
}

/** True if the user is one of the two trade participants. */
export function isParticipant(trade: LiveTradeDoc, userId: string): boolean {
  return String(trade.userA) === userId || String(trade.userB) === userId
}

/** Returns "A" or "B" for the participant, or null. */
export function sideOf(trade: LiveTradeDoc, userId: string): "A" | "B" | null {
  if (String(trade.userA) === userId) return "A"
  if (String(trade.userB) === userId) return "B"
  return null
}

/**
 * Anti-scam: any change to the deal after a confirmation invalidates BOTH
 * confirmations, so nobody can confirm and then quietly alter the contents.
 */
export function resetConfirmations(trade: LiveTradeDoc, byUsername: string): void {
  if (trade.confirmedA || trade.confirmedB) {
    trade.confirmedA = false
    trade.confirmedB = false
    trade.chat.push({
      userId: "system",
      username: "Sistema",
      message: `${byUsername} ha modificato lo scambio: conferme azzerate.`,
      system: true,
      createdAt: new Date(),
    })
  }
}

/**
 * Cancels a live trade whose timer has expired. Returns true when it expired.
 */
export async function lazyExpireTrade(trade: LiveTradeDoc): Promise<boolean> {
  if (trade.status !== "live") return false
  if (new Date(trade.expiresAt).getTime() > Date.now()) return false
  trade.status = "cancelled"
  trade.chat.push({
    userId: "system",
    username: "Sistema",
    message: "Tempo scaduto: scambio annullato automaticamente.",
    system: true,
    createdAt: new Date(),
  })
  await trade.save()
  return true
}
