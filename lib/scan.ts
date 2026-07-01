import { generateText, Output } from "ai"
import { z } from "zod"
import {
  identifyObject,
  gradeCondition,
  estimateValue,
  buildAdvisor,
  analyzeDuplicates,
  isRarityHigh,
  AIError,
  type Identification,
  type Grading,
  type ValueEstimate,
} from "@/lib/ai-valuation"

/**
 * Blocco 35 — Scanner intelligente backend.
 *
 * Stateless, read-only AI analysis for the mobile app. Reuses the Blocco 21
 * valuation engine (`lib/ai-valuation.ts`) but NEVER writes to the database:
 * the scanner gives instant valuations without adding anything to the user's
 * collection. Adding to the collection is a separate, explicit action handled
 * by the existing collection endpoints.
 */

const VISION_MODEL = "openai/gpt-4o"

function mediaTypeFromUrl(url: string): string {
  if (url.startsWith("data:")) {
    const m = url.slice(5, url.indexOf(";"))
    return m || "image/jpeg"
  }
  const clean = url.split("?")[0].toLowerCase()
  if (clean.endsWith(".png")) return "image/png"
  if (clean.endsWith(".webp")) return "image/webp"
  if (clean.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

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

/* -------------------------------------------------------------------------- */
/* CollexSpark commentary (deterministic — no extra tokens)                    */
/* -------------------------------------------------------------------------- */

export type SparkPose = "happy" | "alert" | "deal" | "auction" | "trend"

export interface SparkComment {
  pose: SparkPose
  message: string
}

/** Witty, in-character CollexSpark line derived from the AI signals. */
export function buildSparkComment(input: {
  name: string
  value: number
  trend: "up" | "stable" | "down"
  trendPercent: number
  isRare: boolean
}): SparkComment {
  const { name, value, trend, trendPercent, isRare } = input
  if (isRare && value >= 100) {
    return { pose: "auction", message: `Wow, ${name} è un pezzo raro da € ${Math.round(value)}! Da asta, fidati.` }
  }
  if (trend === "up") {
    return { pose: "trend", message: `${name} sta salendo (${trendPercent > 0 ? "+" : ""}${Math.round(trendPercent)}%). Buon momento per vendere!` }
  }
  if (trend === "down") {
    return { pose: "alert", message: `${name} è in calo (${Math.round(trendPercent)}%). Meglio tenerla e aspettare.` }
  }
  if (value >= 50) {
    return { pose: "deal", message: `${name} vale circa € ${Math.round(value)}. Niente male!` }
  }
  return { pose: "happy", message: `Ho identificato ${name}. Valore stimato € ${Math.round(value)}.` }
}

/* -------------------------------------------------------------------------- */
/* Single scan                                                                */
/* -------------------------------------------------------------------------- */

export interface SingleScanResult {
  identification: Identification
  grading: Grading
  value: ValueEstimate
  advisor: ReturnType<typeof buildAdvisor>
  spark: SparkComment
  isRare: boolean
}

/**
 * Analyses one card/object photo end-to-end. No persistence.
 */
export async function scanSingle(imageUrl: string, categoryHint?: string): Promise<SingleScanResult> {
  const identification = await identifyObject(imageUrl, categoryHint)
  const grading = await gradeCondition(imageUrl)
  const value = await estimateValue({ identification, grading, userValue: null })
  const isRare = isRarityHigh(identification.rarity)
  // Single-photo scan has no DB context, so treat as a single copy.
  const duplicates = analyzeDuplicates(1, isRare)
  const advisor = buildAdvisor({
    rarity: identification.rarity,
    trend: value.trend,
    trendPercent: value.trendPercent,
    duplicates,
  })
  const spark = buildSparkComment({
    name: identification.name,
    value: value.estimated,
    trend: value.trend,
    trendPercent: value.trendPercent,
    isRare,
  })
  return { identification, grading, value, advisor, spark, isRare }
}

/* -------------------------------------------------------------------------- */
/* Multi scan (batch detection)                                               */
/* -------------------------------------------------------------------------- */

const detectedCardSchema = z.object({
  name: z.string().describe("Nome preciso della carta/oggetto"),
  series: z.string().nullable().describe("Serie/franchise, null se sconosciuto"),
  set: z.string().nullable().describe("Set/espansione, null se sconosciuto"),
  rarity: z.string().nullable().describe("Rarità stimata"),
  condition: z.string().describe("Condizione stimata (Mint, NM, EX, Good, Played, Poor)"),
  estimatedValue: z.number().describe("Valore di mercato stimato in EUR"),
  minValue: z.number().describe("Estremo inferiore del range in EUR"),
  maxValue: z.number().describe("Estremo superiore del range in EUR"),
  trend: z.enum(["up", "stable", "down"]).describe("Tendenza recente"),
  trendPercent: z.number().describe("Variazione percentuale stimata"),
  position: z.string().describe("Posizione nella foto, es. 'in alto a sinistra'"),
})

const multiScanSchema = z.object({
  cards: z.array(detectedCardSchema).describe("Tutte le carte/oggetti rilevati nella foto"),
})

export interface DetectedCard extends z.infer<typeof detectedCardSchema> {
  id: string
  isRare: boolean
}

export interface MultiScanResult {
  cards: DetectedCard[]
  totalValue: number
  totalMin: number
  totalMax: number
  count: number
  duplicates: { name: string; count: number }[]
  spark: SparkComment
}

/**
 * Detects and values every card in a single batch photo (10+ cards on a
 * table). Returns a value-sorted list plus totals and duplicate groups. No
 * persistence.
 */
export async function scanMultiple(imageUrl: string, categoryHint?: string): Promise<MultiScanResult> {
  const prompt = [
    "Sei un esperto di carte da collezione con visione artificiale.",
    "Nella foto ci sono PIÙ carte/oggetti disposti su una superficie.",
    "Rileva OGNI singola carta separatamente, anche se sovrapposte parzialmente.",
    categoryHint ? `Categoria suggerita: "${categoryHint}".` : "",
    "Per ciascuna fornisci nome, serie, set, rarità, condizione stimata, valore di mercato in EUR (stima realistica e prudente), range min/max, trend e posizione nella foto.",
    "Sii accurato sul numero di carte: non inventare carte non presenti.",
  ]
    .filter(Boolean)
    .join(" ")

  let cards: z.infer<typeof detectedCardSchema>[]
  try {
    const { output } = await generateText({
      model: VISION_MODEL,
      output: Output.object({ schema: multiScanSchema }),
      messages: imageMessage(prompt, imageUrl),
    })
    cards = output.cards
  } catch (error) {
    console.error("[v0] scanMultiple error:", error)
    throw new AIError("Scansione multipla AI non riuscita.")
  }

  const enriched: DetectedCard[] = cards
    .map((c, i) => ({ ...c, id: `card_${i}`, isRare: isRarityHigh(c.rarity) }))
    .sort((a, b) => b.estimatedValue - a.estimatedValue)

  const totalValue = enriched.reduce((s, c) => s + (c.estimatedValue || 0), 0)
  const totalMin = enriched.reduce((s, c) => s + (c.minValue || 0), 0)
  const totalMax = enriched.reduce((s, c) => s + (c.maxValue || 0), 0)

  // Duplicate groups by normalized name.
  const counts = new Map<string, number>()
  for (const c of enriched) {
    const key = c.name.trim().toLowerCase()
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const duplicates = enriched
    .filter((c, i, arr) => arr.findIndex((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase()) === i)
    .map((c) => ({ name: c.name, count: counts.get(c.name.trim().toLowerCase()) || 1 }))
    .filter((d) => d.count > 1)

  const top = enriched[0]
  const spark: SparkComment = top
    ? {
        pose: top.isRare ? "auction" : "deal",
        message: `Ho trovato ${enriched.length} carte per un totale di € ${Math.round(totalValue)}. La migliore è ${top.name} (€ ${Math.round(top.estimatedValue)}).`,
      }
    : { pose: "alert", message: "Non ho rilevato carte nella foto. Riprova con più luce." }

  return { cards: enriched, totalValue, totalMin, totalMax, count: enriched.length, duplicates, spark }
}
