import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import CollectionItem from "@/lib/models/Collection"
import AIMetadata from "@/lib/models/AIMetadata"
import {
  identifyObject,
  gradeCondition,
  estimateValue,
  analyzeDuplicates,
  buildAdvisor,
  isRarityHigh,
  AIError,
} from "@/lib/ai-valuation"
import {
  notifyValueUp,
  notifyValueDown,
  notifyAuctionOpportunity,
  notifyDuplicatesSurplus,
} from "@/lib/ai-notifications"

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const objectId = typeof body.objectId === "string" ? body.objectId : ""
    if (!objectId) {
      return NextResponse.json({ success: false, message: "objectId mancante." }, { status: 400 })
    }

    await connectDB()

    // Ownership check + source image.
    const item = await CollectionItem.findById(objectId)
    if (!item) {
      return NextResponse.json({ success: false, message: "Oggetto non trovato." }, { status: 404 })
    }
    if (String(item.userId) !== String(userId)) {
      return NextResponse.json({ success: false, message: "Accesso non autorizzato." }, { status: 403 })
    }

    const imageUrl = typeof body.imageUrl === "string" && body.imageUrl ? body.imageUrl : item.image
    if (!imageUrl) {
      return NextResponse.json({ success: false, message: "Nessuna immagine disponibile per l'analisi." }, { status: 400 })
    }

    // --- AI pipeline -------------------------------------------------------
    const identification = await identifyObject(imageUrl, body.category || item.category)
    const grading = await gradeCondition(imageUrl)
    const value = await estimateValue({ identification, grading, userValue: item.value })

    // --- Duplicates (DB-driven) -------------------------------------------
    const escaped = String(identification.name || item.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const total = await CollectionItem.countDocuments({
      userId,
      name: { $regex: `^${escaped}$`, $options: "i" },
    })
    const isRare = isRarityHigh(identification.rarity)
    const duplicates = analyzeDuplicates(total || 1, isRare)

    // --- Advisor -----------------------------------------------------------
    const advisor = buildAdvisor({
      rarity: identification.rarity,
      trend: value.trend,
      trendPercent: value.trendPercent,
      duplicates,
    })

    // --- Persist (preserve prior history, append today's point) -----------
    const previous = await AIMetadata.findOne({ objectId }).lean<{ marketValue?: { estimated?: number; history?: { date: string; value: number }[] } }>()
    const today = new Date().toISOString().slice(0, 10)
    const baseHistory = previous?.marketValue?.history?.length ? previous.marketValue.history : value.history
    const history = [...baseHistory.filter((p) => p.date !== today), { date: today, value: value.estimated }]

    const doc = {
      objectId,
      userId,
      category: identification.category || item.category || "",
      name: identification.name || item.name,
      series: identification.series,
      set: identification.set,
      rarity: identification.rarity,
      number: identification.number,
      edition: identification.edition,
      variants: identification.variants || [],
      certifications: identification.certifications || [],
      grading: { score: grading.score, label: grading.label, defects: grading.defects || [] },
      marketValue: {
        estimated: value.estimated,
        min: value.min,
        max: value.max,
        trend: value.trend,
        forecast30d: value.forecast30d,
        history,
      },
      duplicates: {
        total: duplicates.total,
        recommendedForSale: duplicates.recommendedForSale,
        recommendedForTrade: duplicates.recommendedForTrade,
        recommendedToKeep: duplicates.recommendedToKeep,
      },
      advisor,
      confidence: identification.confidence ?? 0,
    }

    const metadata = await AIMetadata.findOneAndUpdate({ objectId }, doc, { upsert: true, new: true })

    // --- Auto-update the collection item (Blocco 21 §7) -------------------
    item.value = value.estimated
    if (grading.label) item.condition = grading.label
    if (!item.category && identification.category) item.category = identification.category
    await item.save()

    // --- Smart notifications (Blocco 20) ----------------------------------
    const prevEstimated = previous?.marketValue?.estimated || 0
    if (value.trend === "up" && value.trendPercent > 0) {
      void notifyValueUp(userId, objectId, doc.name, value.trendPercent)
    } else if (value.trend === "down" && value.trendPercent < 0) {
      void notifyValueDown(userId, objectId, doc.name, value.trendPercent)
    } else if (prevEstimated > 0 && value.estimated > prevEstimated * 1.1) {
      void notifyValueUp(userId, objectId, doc.name, ((value.estimated - prevEstimated) / prevEstimated) * 100)
    }
    if (advisor.auctionRecommended) void notifyAuctionOpportunity(userId, objectId, doc.name)
    if (duplicates.recommendedForSale > 0) {
      void notifyDuplicatesSurplus(userId, objectId, doc.name, duplicates.recommendedForSale)
    }

    return NextResponse.json({ success: true, metadata, duplicateMessage: duplicates.message })
  } catch (error) {
    if (error instanceof AIError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    console.error("[v0] ai/analyze error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
