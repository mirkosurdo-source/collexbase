import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Review from "@/lib/models/Review"

export const dynamic = "force-dynamic"

/**
 * Blocco 28 — reviews tied to a specific transaction reference (refId). Used by
 * marketplace/trade/auction completed screens to know whether the current user
 * has already left a review. Read-only.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const refId = (id || "").trim()
    if (!refId) return NextResponse.json({ error: "Riferimento mancante." }, { status: 400 })

    await connectDB()
    const reviews = await Review.find({ refId }).sort({ createdAt: -1 }).lean()

    return NextResponse.json({ success: true, reviews })
  } catch (err) {
    console.error("[v0] reviews/transaction error:", err)
    return NextResponse.json({ error: "Errore durante il caricamento delle recensioni." }, { status: 500 })
  }
}
