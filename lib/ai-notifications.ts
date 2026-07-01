import { createNotification } from "@/lib/notifications"

/**
 * Blocco 21 — AI-driven smart notifications.
 *
 * These wrap the Blocco 20 createNotification helper (no model changes) and map
 * each AI insight onto an existing notification type + deep-link context. All
 * are fire-and-forget; failures are swallowed inside createNotification.
 */

/** Price increased meaningfully since the last analysis. */
export async function notifyValueUp(userId: string, objectId: string, name: string, pct: number) {
  await createNotification({
    userId,
    type: "marketplace",
    title: `${name} è aumentato del ${Math.round(pct)}%`,
    body: "Il valore stimato di un oggetto della tua collezione è salito. Potrebbe essere un buon momento per vendere.",
    context: { kind: "listing", id: objectId },
  })
}

/** Price dropped — suggest holding. */
export async function notifyValueDown(userId: string, objectId: string, name: string, pct: number) {
  await createNotification({
    userId,
    type: "marketplace",
    title: `${name}: trend negativo (${Math.round(pct)}%)`,
    body: "Il valore stimato è in calo. L'AI consiglia di tenere e attendere.",
    context: { kind: "listing", id: objectId },
  })
}

/** A rare item is a good auction candidate. */
export async function notifyAuctionOpportunity(userId: string, objectId: string, name: string) {
  await createNotification({
    userId,
    type: "auction",
    title: `Oggetto raro: asta consigliata per ${name}`,
    body: "L'AI ha rilevato rarità e domanda elevata. Un'asta potrebbe superare il valore stimato.",
    context: { kind: "listing", id: objectId },
  })
}

/** The user holds surplus duplicates that could be sold. */
export async function notifyDuplicatesSurplus(userId: string, objectId: string, name: string, sellCount: number) {
  if (sellCount <= 0) return
  await createNotification({
    userId,
    type: "marketplace",
    title: `Hai copie in eccesso di ${name}`,
    body: `L'AI consiglia di venderne ${sellCount}.`,
    context: { kind: "listing", id: objectId },
  })
}

/** A wishlist item is available in the marketplace below its target price. */
export async function notifyWishlistOpportunity(userId: string, listingId: string, name: string, price: number) {
  await createNotification({
    userId,
    type: "marketplace",
    title: `Oggetto wishlist disponibile: ${name}`,
    body: `Disponibile nel marketplace a € ${price.toLocaleString("it-IT")}, sotto il tuo prezzo obiettivo.`,
    context: { kind: "listing", id: listingId },
  })
}

/** Blocco 24 — a wishlist item hit its lowest price in 30 days. */
export async function notifyWishlistPriceDrop(userId: string, listingId: string, name: string, price: number) {
  await createNotification({
    userId,
    type: "marketplace",
    title: `⚡ CollexSpark: prezzo più basso per ${name}`,
    body: `Disponibile a € ${price.toLocaleString("it-IT")} — il prezzo più basso degli ultimi 30 giorni!`,
    context: { kind: "listing", id: listingId },
  })
}

/** Blocco 24 — a rare wishlist item appeared. */
export async function notifyWishlistRare(userId: string, listingId: string, name: string) {
  await createNotification({
    userId,
    type: "marketplace",
    title: `⚡ CollexSpark: opportunità rara — ${name}`,
    body: "Questo pezzo è difficile da trovare ed è disponibile ora.",
    context: { kind: "listing", id: listingId },
  })
}

/** Blocco 24 — a wishlist item is up for auction. */
export async function notifyWishlistAuction(userId: string, auctionId: string, name: string, price: number) {
  await createNotification({
    userId,
    type: "auction",
    title: `⚡ CollexSpark: asta in corso per ${name}`,
    body: `Offerta attuale € ${price.toLocaleString("it-IT")}. Imposta il tuo limite massimo e rilancia.`,
    context: { kind: "auction", id: auctionId },
  })
}

/** Blocco 24 — a brand-new listing matches the wishlist. */
export async function notifyWishlistNewListing(userId: string, listingId: string, name: string, price: number) {
  await createNotification({
    userId,
    type: "marketplace",
    title: `⚡ CollexSpark: nuovo annuncio per ${name}`,
    body: `Nuovo annuncio corrispondente alla tua wishlist a € ${price.toLocaleString("it-IT")}.`,
    context: { kind: "listing", id: listingId },
  })
}

/** Generic "good moment to sell" nudge. */
export async function notifyGoodTimeToSell(userId: string, objectId: string, name: string) {
  await createNotification({
    userId,
    type: "marketplace",
    title: `Buon momento per vendere ${name}`,
    body: "Le condizioni di mercato sono favorevoli secondo l'analisi AI.",
    context: { kind: "listing", id: objectId },
  })
}
