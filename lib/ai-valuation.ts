import { generateText, Output } from "ai"
import { z } from "zod"

/**
 * Blocco 21 — AI valuation engine.
 *
 * Thin, well-typed wrappers around the AI SDK (Vercel AI Gateway, zero-config
 * OpenAI vision) that power object identification, condition grading and market
 * valuation. Every call is defensive: on failure it throws an AIError so the
 * route layer can translate it into a clean 5xx without leaking internals.
 */

// Vision-capable, zero-config through the AI Gateway.
const VISION_MODEL = "openai/gpt-4o"

export class AIError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = "AIError"
    this.status = status
  }
}

/** Best-effort media type from a URL extension (FilePart requires one). */
function mediaTypeFromUrl(url: string): string {
  const clean = url.split("?")[0].toLowerCase()
  if (clean.endsWith(".png")) return "image/png"
  if (clean.endsWith(".webp")) return "image/webp"
  if (clean.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

/** Builds a multimodal user message with text instructions + an image. */
function imageMessage(text: string, imageUrl: string) {
  return [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text },
        { type: "file" as const, data: imageUrl, mediaType: mediaTypeFromUrl(imageUrl) },
      ],
    },
  ]
}

const SUPPORTED_CATEGORIES = [
  "carte",
  "statuette",
  "bambole",
  "lego",
  "funko pop",
  "modellini",
  "manga/fumetti",
  "sneakers",
  "monete/banconote",
  "francobolli",
  "memorabilia",
  "altro",
] as const

/* -------------------------------------------------------------------------- */
/* 1. Identification                                                          */
/* -------------------------------------------------------------------------- */

export const identificationSchema = z.object({
  name: z.string().describe("Nome preciso dell'oggetto da collezione"),
  category: z.string().describe("Categoria, una tra quelle supportate"),
  series: z.string().nullable().describe("Serie/franchise, null se non applicabile"),
  set: z.string().nullable().describe("Set/espansione, null se sconosciuto"),
  rarity: z.string().nullable().describe("Rarità (es. Common, Rare, Secret Rare)"),
  number: z.string().nullable().describe("Numero di catalogo/carta, null se assente"),
  edition: z.string().nullable().describe("Edizione (es. 1st Edition, Unlimited)"),
  variants: z.array(z.string()).describe("Eventuali varianti note (holo, reverse, ecc.)"),
  certifications: z.array(z.string()).describe("Certificazioni visibili (PSA/BGS/CGC) con grado se leggibile"),
  confidence: z.number().min(0).max(1).describe("Confidenza dell'identificazione tra 0 e 1"),
})

export type Identification = z.infer<typeof identificationSchema>

export async function identifyObject(imageUrl: string, categoryHint?: string): Promise<Identification> {
  const prompt = [
    "Sei un esperto di oggetti da collezione. Identifica l'oggetto nell'immagine.",
    `Categorie supportate: ${SUPPORTED_CATEGORIES.join(", ")}.`,
    categoryHint ? `Suggerimento categoria fornito dall'utente: "${categoryHint}".` : "",
    "Rispondi solo con i dati strutturati richiesti. Usa null per i campi non determinabili.",
    "Riconosci certificazioni PSA/BGS/CGC se presenti sull'etichetta.",
  ]
    .filter(Boolean)
    .join(" ")

  try {
    const { output } = await generateText({
      model: VISION_MODEL,
      output: Output.object({ schema: identificationSchema }),
      messages: imageMessage(prompt, imageUrl),
    })
    return output
  } catch (error) {
    console.error("[v0] identifyObject error:", error)
    throw new AIError("Identificazione AI non riuscita.")
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Grading                                                                 */
/* -------------------------------------------------------------------------- */

export const gradingSchema = z.object({
  score: z.number().min(0).max(10).describe("Punteggio condizione 0-10"),
  label: z.enum(["Mint", "NM", "EX", "Good", "Played", "Poor"]).describe("Etichetta condizione"),
  defects: z.array(z.string()).describe("Difetti rilevati (graffi, pieghe, ingiallimento...)"),
  centering: z.string().describe("Valutazione della centratura, es. '60/40'"),
  whitening: z.string().describe("Presenza di whitening sui bordi"),
  surface: z.string().describe("Stato della superficie (graffi, aloni)"),
  estimatedGrade: z.string().describe("Stima equivalente PSA/BGS/CGC, es. 'PSA 8'"),
})

export type Grading = z.infer<typeof gradingSchema>

export async function gradeCondition(imageUrl: string): Promise<Grading> {
  const prompt = [
    "Sei un perito di grading professionale (stile PSA/BGS/CGC).",
    "Valuta le condizioni dell'oggetto nell'immagine.",
    "Assegna un punteggio 0-10 ed un'etichetta tra Mint, NM, EX, Good, Played, Poor.",
    "Elenca i difetti visibili e valuta centratura, whitening e superficie.",
    "Fornisci una stima del grado equivalente PSA/BGS/CGC.",
  ].join(" ")

  try {
    const { output } = await generateText({
      model: VISION_MODEL,
      output: Output.object({ schema: gradingSchema }),
      messages: imageMessage(prompt, imageUrl),
    })
    return output
  } catch (error) {
    console.error("[v0] gradeCondition error:", error)
    throw new AIError("Grading AI non riuscito.")
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Market value                                                            */
/* -------------------------------------------------------------------------- */

export const valueSchema = z.object({
  estimated: z.number().describe("Valore di mercato stimato in EUR"),
  min: z.number().describe("Estremo inferiore del range in EUR"),
  max: z.number().describe("Estremo superiore del range in EUR"),
  trend: z.enum(["up", "stable", "down"]).describe("Tendenza recente del valore"),
  trendPercent: z.number().describe("Variazione percentuale stimata recente (può essere negativa)"),
  forecast30d: z.number().describe("Valore previsto fra 30 giorni in EUR"),
  history: z
    .array(z.object({ date: z.string(), value: z.number() }))
    .describe("Storico prezzi mensile degli ultimi 6 mesi (6 punti)"),
  rationale: z.string().describe("Breve motivazione della stima in italiano"),
})

export type ValueEstimate = z.infer<typeof valueSchema>

export async function estimateValue(input: {
  identification: Partial<Identification>
  grading?: Partial<Grading> | null
  userValue?: number | null
}): Promise<ValueEstimate> {
  const { identification, grading, userValue } = input
  const prompt = [
    "Sei un analista del mercato del collezionismo con conoscenza di eBay, Cardmarket, PWCC e case d'asta.",
    "Stima il valore di mercato realistico in EUR per il seguente oggetto.",
    `Dati oggetto: ${JSON.stringify(identification)}.`,
    grading ? `Condizioni: ${JSON.stringify(grading)}.` : "",
    userValue ? `Valore indicato dall'utente: € ${userValue}.` : "",
    "Fornisci stima, range min/max, trend, variazione percentuale, previsione a 30 giorni",
    "e uno storico mensile plausibile degli ultimi 6 mesi. Sii realistico e prudente.",
  ]
    .filter(Boolean)
    .join(" ")

  try {
    const { output } = await generateText({
      model: VISION_MODEL,
      output: Output.object({ schema: valueSchema }),
      prompt,
    })
    return output
  } catch (error) {
    console.error("[v0] estimateValue error:", error)
    throw new AIError("Valutazione di mercato AI non riuscita.")
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Duplicates (deterministic, DB-driven)                                   */
/* -------------------------------------------------------------------------- */

export interface DuplicateAnalysis {
  total: number
  recommendedForSale: number
  recommendedForTrade: number
  recommendedToKeep: number
  rareAuctionSuggested: boolean
  message: string
}

/**
 * Pure function: given how many copies the user owns and whether the item is
 * rare, recommends how many to sell / trade / keep. Keeping this deterministic
 * makes the advice predictable and avoids spending tokens on arithmetic.
 */
export function analyzeDuplicates(total: number, isRare: boolean): DuplicateAnalysis {
  const safeTotal = Math.max(1, Math.floor(total))
  const keep = isRare && safeTotal > 1 ? 2 : 1
  const remaining = Math.max(0, safeTotal - keep)
  // Split the surplus: favour selling, keep some for trading.
  const recommendedForTrade = Math.floor(remaining / 3)
  const recommendedForSale = remaining - recommendedForTrade
  const recommendedToKeep = Math.min(keep, safeTotal)

  let message: string
  if (safeTotal <= 1) {
    message = "Hai 1 copia: l'AI consiglia di tenerla."
  } else {
    message = `Hai ${safeTotal} copie. L'AI consiglia di venderne ${recommendedForSale}` +
      (recommendedForTrade > 0 ? `, scambiarne ${recommendedForTrade}` : "") +
      ` e tenerne ${recommendedToKeep}.`
  }

  return {
    total: safeTotal,
    recommendedForSale,
    recommendedForTrade,
    recommendedToKeep,
    rareAuctionSuggested: isRare && safeTotal >= 1,
    message,
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Advisor (deterministic decision from the AI signals)                    */
/* -------------------------------------------------------------------------- */

export interface Advisor {
  sellNow: boolean
  hold: boolean
  auctionRecommended: boolean
  tradeRecommended: boolean
  reason: string
}

/** Turns the AI signals into an actionable, explainable recommendation. */
export function buildAdvisor(input: {
  rarity?: string | null
  trend: "up" | "stable" | "down"
  trendPercent: number
  duplicates: DuplicateAnalysis
}): Advisor {
  const { rarity, trend, trendPercent, duplicates } = input
  const isRare = isRarityHigh(rarity)
  const reasons: string[] = []

  // Auction is recommended for rare items with healthy demand / rising trend.
  const auctionRecommended = isRare && trend !== "down"
  if (auctionRecommended) reasons.push("Oggetto raro con domanda elevata: l'asta può superare il valore stimato.")

  // Sell now when the trend is positive or there is a surplus of copies.
  const sellNow = trend === "up" || duplicates.recommendedForSale > 0
  if (trend === "up") reasons.push(`Trend in aumento (${formatPct(trendPercent)}): buon momento per vendere.`)
  if (duplicates.recommendedForSale > 0) reasons.push(`Hai copie in eccesso: puoi venderne ${duplicates.recommendedForSale}.`)

  // Hold when the trend is falling and there is no surplus.
  const hold = trend === "down" && duplicates.recommendedForSale === 0
  if (hold) reasons.push(`Trend negativo (${formatPct(trendPercent)}): meglio tenere e attendere.`)

  const tradeRecommended = duplicates.recommendedForTrade > 0
  if (tradeRecommended) reasons.push("Alcune copie sono adatte allo scambio.")

  if (reasons.length === 0) reasons.push("Valore stabile: nessuna azione urgente consigliata.")

  return { sellNow, hold, auctionRecommended, tradeRecommended, reason: reasons.join(" ") }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const HIGH_RARITY = ["rare", "secret", "ultra", "holo", "special", "promo", "limited", "1st", "raro", "leggendar"]

export function isRarityHigh(rarity?: string | null): boolean {
  if (!rarity) return false
  const r = rarity.toLowerCase()
  return HIGH_RARITY.some((k) => r.includes(k))
}

function formatPct(pct: number): string {
  const sign = pct > 0 ? "+" : ""
  return `${sign}${pct.toFixed(0)}%`
}
