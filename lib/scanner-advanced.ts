import { generateText, Output } from "ai"
import { z } from "zod"
import { estimateValue, isRarityHigh, AIError, type Identification } from "@/lib/ai-valuation"

/**
 * Blocco 40 — advanced 3D / OCR scanner engine.
 *
 * Builds on the Blocco 21 valuation engine (`lib/ai-valuation.ts`) without
 * modifying it. A single multimodal vision call analyses up to 6 photos
 * (front, back, 4 corners) and returns structured grading data: OCR
 * identification, centering, corners, edges, surface, defects and authenticity.
 * The overall grade and the PSA-tier market values are then derived
 * deterministically so the numbers are explainable and reproducible.
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

/** Builds a single multimodal message with text instructions + every photo. */
function multiImageMessage(text: string, imageUrls: string[]) {
  return [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text },
        ...imageUrls.map((url) => ({
          type: "file" as const,
          data: url,
          mediaType: mediaTypeFromUrl(url),
        })),
      ],
    },
  ]
}

/* -------------------------------------------------------------------------- */
/* AI analysis schema                                                         */
/* -------------------------------------------------------------------------- */

// 0-100 intensity for defects (higher = worse); 0-100 confidence for authenticity.
const analysisSchema = z.object({
  cardIdentified: z.object({
    name: z.string().describe("Nome preciso della carta"),
    set: z.string().describe("Set/espansione, stringa vuota se sconosciuto"),
    number: z.string().describe("Numero di catalogo/carta, vuoto se assente"),
    year: z.number().describe("Anno di stampa stimato, 0 se sconosciuto"),
    variant: z.string().describe("Variante (reverse holo, full art, promo...), vuoto se nessuna"),
    rarity: z.string().describe("Rarità stimata, vuoto se sconosciuta"),
    imageMatchConfidence: z.number().min(0).max(1).describe("Confidenza identificazione 0-1"),
  }),
  centering: z.object({
    left: z.number().min(0).max(100).describe("Percentuale bordo sinistro"),
    right: z.number().min(0).max(100).describe("Percentuale bordo destro"),
    top: z.number().min(0).max(100).describe("Percentuale bordo superiore"),
    bottom: z.number().min(0).max(100).describe("Percentuale bordo inferiore"),
  }),
  // Sub-scores 0-10 (higher = better condition).
  cornersScore: z.number().min(0).max(10).describe("Qualità angoli 0-10 (sharpness, no rounding/bending)"),
  edgesScore: z.number().min(0).max(10).describe("Qualità bordi 0-10 (no chipping/whitening)"),
  surfaceScore: z.number().min(0).max(10).describe("Qualità superficie 0-10 (no graffi/aloni/print lines)"),
  defects: z.object({
    whitening: z.number().min(0).max(100).describe("Intensità whitening sui bordi 0-100"),
    scratches: z.number().min(0).max(100).describe("Intensità graffi 0-100"),
    dents: z.number().min(0).max(100).describe("Intensità ammaccature/denti 0-100"),
    edgeWear: z.number().min(0).max(100).describe("Usura dei bordi 0-100"),
    holoScratches: z.number().min(0).max(100).describe("Graffi sull'holo 0-100"),
    printLines: z.number().min(0).max(100).describe("Linee di stampa 0-100"),
  }),
  authenticity: z.object({
    holoPattern: z.number().min(0).max(100).describe("Coerenza pattern holo 0-100"),
    printPattern: z.number().min(0).max(100).describe("Coerenza pattern di stampa 0-100"),
    fontMatch: z.number().min(0).max(100).describe("Corrispondenza font 0-100"),
    borderMatch: z.number().min(0).max(100).describe("Corrispondenza bordi/colori 0-100"),
  }),
  notes: z.string().describe("Brevi note del perito in italiano"),
})

export type ScannerAnalysis = z.infer<typeof analysisSchema>

/* -------------------------------------------------------------------------- */
/* Result shape (what gets persisted + returned)                              */
/* -------------------------------------------------------------------------- */

export interface ScanResultData {
  cardIdentified: {
    name: string
    set: string
    number: string
    year: number
    variant: string
    imageMatchConfidence: number
  }
  grading: {
    overall: number
    centering: number
    corners: number
    edges: number
    surface: number
  }
  centering: {
    left: number
    right: number
    top: number
    bottom: number
    percent: number
    deviation: number
  }
  defects: {
    whitening: number
    scratches: number
    dents: number
    edgeWear: number
    holoScratches: number
    printLines: number
  }
  authenticity: {
    holoPattern: number
    printPattern: number
    fontMatch: number
    borderMatch: number
    authenticityScore: number
  }
  marketValue: {
    raw: number
    graded: number
    grade10: number
    grade9: number
    grade8: number
    history: { date: string; value: number }[]
  }
  notes: string
}

/* -------------------------------------------------------------------------- */
/* Deterministic scoring helpers                                              */
/* -------------------------------------------------------------------------- */

const round1 = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/**
 * Converts the four centering edge percentages into a 0-10 score plus the
 * overall centering percentage and deviation. Perfect centering = symmetric
 * opposite borders (left≈right, top≈bottom).
 */
export function computeCentering(c: { left: number; right: number; top: number; bottom: number }) {
  const hTotal = c.left + c.right || 1
  const vTotal = c.top + c.bottom || 1
  // Ratio of the smaller side to the larger side (1 = perfect, 0.5 = 66/33).
  const hRatio = Math.min(c.left, c.right) / (Math.max(c.left, c.right) || 1)
  const vRatio = Math.min(c.top, c.bottom) / (Math.max(c.top, c.bottom) || 1)
  const percent = round1(((hRatio + vRatio) / 2) * 100)
  // Deviation from a perfect 50/50 split, averaged over both axes.
  const deviation = round1(
    (Math.abs(c.left / hTotal - 0.5) + Math.abs(c.top / vTotal - 0.5)) * 100,
  )
  // Map percent (50%..100%) onto a 0-10 score.
  const score = clamp(round1((percent - 50) / 5), 0, 10)
  return { percent, deviation, score }
}

/**
 * Derives the overall 0-10 grade from the four sub-scores, then applies a
 * penalty for severe defects and weak authenticity. PSA-style: the overall is
 * close to the weakest sub-score, not a plain average.
 */
export function computeOverall(input: {
  centering: number
  corners: number
  edges: number
  surface: number
  defects: ScannerAnalysis["defects"]
  authenticityScore: number
}): number {
  const { centering, corners, edges, surface, defects, authenticityScore } = input
  const subs = [centering, corners, edges, surface]
  const avg = subs.reduce((s, n) => s + n, 0) / subs.length
  const weakest = Math.min(...subs)
  // Weight the weakest link heavily (grading is bottlenecked by worst aspect).
  let base = avg * 0.5 + weakest * 0.5
  // Defect penalty: average defect intensity (0-100) shaves up to ~1.5 points.
  const defectAvg =
    (defects.whitening +
      defects.scratches +
      defects.dents +
      defects.edgeWear +
      defects.holoScratches +
      defects.printLines) /
    6
  base -= (defectAvg / 100) * 1.5
  // Authenticity doubts cap the grade.
  if (authenticityScore < 60) base = Math.min(base, 6)
  if (authenticityScore < 40) base = Math.min(base, 3)
  return clamp(round1(base), 0, 10)
}

/** Averages the four authenticity confidences into a single 0-100 score. */
export function computeAuthenticityScore(a: ScannerAnalysis["authenticity"]): number {
  return Math.round((a.holoPattern + a.printPattern + a.fontMatch + a.borderMatch) / 4)
}

/**
 * Derives PSA-tier market values from the AI raw estimate. Graded cards command
 * a premium that scales steeply with the grade (10 >> 9 > 8 > raw).
 */
export function computeMarketTiers(rawEstimate: number, overall: number) {
  const raw = Math.max(0, Math.round(rawEstimate))
  const grade10 = Math.round(raw * 4.5)
  const grade9 = Math.round(raw * 2.2)
  const grade8 = Math.round(raw * 1.4)
  // The "graded" headline value reflects the achieved overall grade.
  let graded = raw
  if (overall >= 9.5) graded = grade10
  else if (overall >= 8.5) graded = grade9
  else if (overall >= 7.5) graded = grade8
  else graded = Math.round(raw * 1.1)
  return { raw, graded, grade10, grade9, grade8 }
}

/* -------------------------------------------------------------------------- */
/* Main analysis                                                              */
/* -------------------------------------------------------------------------- */

/** Runs the full multi-image AI analysis and assembles the structured result. */
export async function analyzeScan(imageUrls: string[], categoryHint?: string): Promise<ScanResultData> {
  if (imageUrls.length === 0) throw new AIError("Nessuna immagine da analizzare.", 400)

  const prompt = [
    "Sei un perito di grading professionale (stile PSA/BGS/CGC) con visione artificiale.",
    `Ti vengono fornite ${imageUrls.length} foto della STESSA carta (fronte, retro e/o angoli ravvicinati).`,
    categoryHint ? `Categoria: "${categoryHint}".` : "",
    "Analizza con la massima precisione: identificazione OCR (nome, set, numero, anno, variante),",
    "centratura (percentuali dei quattro bordi), qualità di angoli/bordi/superficie (0-10),",
    "difetti (whitening, graffi, denti, edge wear, holo scratches, print lines, intensità 0-100),",
    "e autenticità (pattern holo, pattern stampa, font, bordi, confidenza 0-100).",
    "Sii realistico e prudente. Usa stringa vuota o 0 per i campi non determinabili.",
  ]
    .filter(Boolean)
    .join(" ")

  let analysis: ScannerAnalysis
  try {
    const { output } = await generateText({
      model: VISION_MODEL,
      output: Output.object({ schema: analysisSchema }),
      messages: multiImageMessage(prompt, imageUrls),
    })
    analysis = output
  } catch (error) {
    console.error("[v0] analyzeScan error:", error)
    throw new AIError("Analisi avanzata AI non riuscita.")
  }

  // Deterministic scoring from the AI signals.
  const centering = computeCentering(analysis.centering)
  const authenticityScore = computeAuthenticityScore(analysis.authenticity)
  const overall = computeOverall({
    centering: centering.score,
    corners: analysis.cornersScore,
    edges: analysis.edgesScore,
    surface: analysis.surfaceScore,
    defects: analysis.defects,
    authenticityScore,
  })

  // Reuse the Blocco 21 market engine for the raw estimate + price history.
  const identification: Partial<Identification> = {
    name: analysis.cardIdentified.name,
    set: analysis.cardIdentified.set || null,
    number: analysis.cardIdentified.number || null,
    rarity: analysis.cardIdentified.rarity || null,
  }
  let rawEstimate = 0
  let history: { date: string; value: number }[] = []
  try {
    const value = await estimateValue({
      identification,
      grading: { score: overall, label: gradeLabel(overall) },
      userValue: null,
    })
    rawEstimate = value.estimated
    history = value.history
  } catch (error) {
    // Market estimate is best-effort; grading still returns without it.
    console.error("[v0] analyzeScan value error:", error)
  }

  const tiers = computeMarketTiers(rawEstimate, overall)

  return {
    cardIdentified: {
      name: analysis.cardIdentified.name,
      set: analysis.cardIdentified.set,
      number: analysis.cardIdentified.number,
      year: analysis.cardIdentified.year,
      variant: analysis.cardIdentified.variant,
      imageMatchConfidence: round1(analysis.cardIdentified.imageMatchConfidence * 100),
    },
    grading: {
      overall,
      centering: centering.score,
      corners: round1(analysis.cornersScore),
      edges: round1(analysis.edgesScore),
      surface: round1(analysis.surfaceScore),
    },
    centering: {
      left: Math.round(analysis.centering.left),
      right: Math.round(analysis.centering.right),
      top: Math.round(analysis.centering.top),
      bottom: Math.round(analysis.centering.bottom),
      percent: centering.percent,
      deviation: centering.deviation,
    },
    defects: { ...analysis.defects },
    authenticity: { ...analysis.authenticity, authenticityScore },
    marketValue: { ...tiers, history },
    notes: analysis.notes,
  }
}

/** PSA-style label from a 0-10 grade. */
export function gradeLabel(overall: number): "Mint" | "NM" | "EX" | "Good" | "Played" | "Poor" {
  if (overall >= 9.5) return "Mint"
  if (overall >= 8) return "NM"
  if (overall >= 6) return "EX"
  if (overall >= 4) return "Good"
  if (overall >= 2) return "Played"
  return "Poor"
}

/**
 * Recomputes grading + market tiers from an existing stored result without a
 * new AI call. Used by POST /api/scanner/grade. Pure and deterministic.
 */
export function recomputeGrading(result: ScanResultData): ScanResultData {
  const centering = computeCentering(result.centering)
  const authenticityScore = computeAuthenticityScore({
    holoPattern: result.authenticity.holoPattern,
    printPattern: result.authenticity.printPattern,
    fontMatch: result.authenticity.fontMatch,
    borderMatch: result.authenticity.borderMatch,
  })
  const overall = computeOverall({
    centering: centering.score,
    corners: result.grading.corners,
    edges: result.grading.edges,
    surface: result.grading.surface,
    defects: result.defects,
    authenticityScore,
  })
  const tiers = computeMarketTiers(result.marketValue.raw, overall)
  return {
    ...result,
    grading: { ...result.grading, overall, centering: centering.score },
    centering: { ...result.centering, percent: centering.percent, deviation: centering.deviation },
    authenticity: { ...result.authenticity, authenticityScore },
    marketValue: { ...result.marketValue, ...tiers },
  }
}
