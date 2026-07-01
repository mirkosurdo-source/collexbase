// Lightweight, deterministic "AI advisor" heuristics for the marketplace.
// These produce stable, explainable suggestions without an external model,
// based on declared value, condition, rarity, category demand and recency.

// Relative demand index per category (1.0 = neutral). Higher = hotter market.
const CATEGORY_DEMAND: Record<string, number> = {
  Pokémon: 1.35,
  "One Piece": 1.25,
  Labubu: 1.4,
  LEGO: 1.15,
  "Funko Pop": 1.05,
  Manga: 1.1,
  Fumetti: 1.0,
  "Videogiochi retro": 1.2,
  "Console retro": 1.18,
  Monete: 1.08,
  Banconote: 1.02,
  Francobolli: 0.95,
  Orologi: 1.3,
  Sneakers: 1.22,
  Modellini: 1.0,
  Memorabilia: 1.05,
}

const CONDITION_FACTOR: Record<string, number> = {
  Nuovo: 1.15,
  "Come nuovo": 1.08,
  Ottimo: 1.0,
  Buono: 0.9,
  Discreto: 0.78,
  Rovinato: 0.6,
}

const RARITY_FACTOR: Record<string, number> = {
  Comune: 1.0,
  "Non comune": 1.1,
  Raro: 1.3,
  "Ultra raro": 1.6,
  Leggendario: 2.0,
}

function clampFactor(map: Record<string, number>, key: string, fallback = 1.0): number {
  return map[key] ?? fallback
}

export interface PriceInput {
  value: number
  category?: string
  condition?: string
  rarity?: string
  year?: number | null
}

export interface PriceSuggestion {
  suggested: number
  min: number
  max: number
  demand: number
  rationale: string[]
}

/** Suggests an ideal listing price with a fair range and human-readable rationale. */
export function suggestPrice(input: PriceInput): PriceSuggestion {
  const base = Math.max(1, input.value || 1)
  const demand = clampFactor(CATEGORY_DEMAND, input.category || "", 1.0)
  const cond = clampFactor(CONDITION_FACTOR, input.condition || "", 1.0)
  const rarity = clampFactor(RARITY_FACTOR, input.rarity || "", 1.0)

  // Vintage bonus: older items get a mild premium.
  let vintage = 1.0
  if (typeof input.year === "number" && input.year > 0) {
    const age = new Date().getFullYear() - input.year
    vintage = 1 + Math.min(0.25, Math.max(0, age) * 0.005)
  }

  const suggested = Math.round(base * demand * cond * rarity * vintage)
  const min = Math.round(suggested * 0.85)
  const max = Math.round(suggested * 1.2)

  const rationale: string[] = []
  rationale.push(`Valore dichiarato di base: € ${base}.`)
  if (demand !== 1) rationale.push(`Domanda della categoria ${demand > 1 ? "alta" : "bassa"} (x${demand.toFixed(2)}).`)
  if (cond !== 1) rationale.push(`Stato "${input.condition}" applica un fattore x${cond.toFixed(2)}.`)
  if (rarity !== 1) rationale.push(`Rarità "${input.rarity}" applica un fattore x${rarity.toFixed(2)}.`)
  if (vintage > 1) rationale.push(`Bonus vintage x${vintage.toFixed(2)}.`)
  rationale.push(`Prezzo ideale stimato € ${suggested} (range € ${min}–€ ${max}).`)

  return { suggested, min, max, demand, rationale }
}

export interface FairnessInput {
  askValue: number // value the seller is giving up (listing price or item value)
  offerValue: number // value the buyer is offering (cash + items + coins worth)
}

export interface FairnessResult {
  score: number // 0-100, 50 = perfectly balanced toward seller's favor threshold
  verdict: "ottima" | "equa" | "sfavorevole" | "molto sfavorevole"
  ratio: number
  message: string
}

// 100 CollexCoins ≈ €1 of bartering value for fairness estimation.
export const COINS_TO_EUR = 0.01

/** Evaluates how fair an offer/trade is for the recipient (the seller). */
export function evaluateFairness({ askValue, offerValue }: FairnessInput): FairnessResult {
  const ask = Math.max(1, askValue)
  const ratio = offerValue / ask
  const score = Math.round(Math.min(100, Math.max(0, ratio * 50)))

  let verdict: FairnessResult["verdict"]
  if (ratio >= 1.1) verdict = "ottima"
  else if (ratio >= 0.9) verdict = "equa"
  else if (ratio >= 0.7) verdict = "sfavorevole"
  else verdict = "molto sfavorevole"

  const pct = Math.round(ratio * 100)
  const message =
    verdict === "ottima"
      ? `L'offerta vale circa il ${pct}% del valore richiesto: conviene accettarla.`
      : verdict === "equa"
        ? `L'offerta è equa (~${pct}% del valore): in linea di mercato.`
        : verdict === "sfavorevole"
          ? `L'offerta copre solo il ~${pct}% del valore: valuta una controproposta.`
          : `L'offerta è molto bassa (~${pct}% del valore): meglio rifiutare o controproporre.`

  return { score, verdict, ratio: Math.round(ratio * 100) / 100, message }
}

export interface AdvisorInput {
  mode: "sell" | "buy"
  value: number
  category?: string
  condition?: string
  rarity?: string
  year?: number | null
  marketPrice?: number | null
}

/** General sell/buy advisor combining price suggestion with market context. */
export function advisor(input: AdvisorInput) {
  const price = suggestPrice(input)
  const tips: string[] = []

  if (input.mode === "sell") {
    tips.push(`Pubblica intorno a € ${price.suggested} per massimizzare le probabilità di vendita.`)
    if (price.demand > 1.2) tips.push("La domanda è alta: puoi puntare al limite superiore del range.")
    if (price.demand < 1) tips.push("Domanda debole: un prezzo competitivo accelera la vendita.")
    tips.push("Aggiungi foto extra e dettagli su stato e certificazione per aumentare la fiducia.")
  } else {
    const market = input.marketPrice ?? price.suggested
    if (market <= price.min) tips.push("Prezzo sotto la stima: buona occasione d'acquisto.")
    else if (market >= price.max) tips.push("Prezzo sopra la stima: tratta o attendi un'offerta migliore.")
    else tips.push("Prezzo in linea con il mercato: acquisto ragionevole.")
    tips.push(`Riferimento di valore stimato: € ${price.suggested}.`)
  }

  return { price, tips }
}

/** Wishlist monitor: compares a live market price against the user's target. */
export function monitorWishlist(targetPrice: number, marketPrice: number | null) {
  if (marketPrice == null) {
    return { status: "unavailable" as const, message: "Nessun annuncio attivo per questo oggetto." }
  }
  if (marketPrice <= targetPrice) {
    return {
      status: "deal" as const,
      message: `Disponibile a € ${marketPrice}, sotto il tuo obiettivo di € ${targetPrice}.`,
    }
  }
  const diff = Math.round(((marketPrice - targetPrice) / targetPrice) * 100)
  return {
    status: "watching" as const,
    message: `Prezzo attuale € ${marketPrice}, ${diff}% sopra il tuo obiettivo di € ${targetPrice}.`,
  }
}
