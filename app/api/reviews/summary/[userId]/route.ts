import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { getReviewSummary } from "@/lib/reviews"

export const dynamic = "force-dynamic"

/**
 * Blocco 28 — review summary for a user: media voto, totale e breakdown per
 * categoria (venditore/acquirente/scambio) + trust badges. Read-only.
 * Accepts either a Mongo userId or a username.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await ctx.params
    const handle = (userId || "").trim()
    if (!handle) return NextResponse.json({ error: "Utente mancante." }, { status: 400 })

    await connectDB()

    // Resolve username -> id when needed.
    let resolvedId = handle
    if (!/^[a-f\d]{24}$/i.test(handle)) {
      const user = await User.findOne({ username: handle }).select("_id")
      if (!user) return NextResponse.json({ error: "Utente non trovato." }, { status: 404 })
      resolvedId = String(user._id)
    }

    const summary = await getReviewSummary(resolvedId)
    return NextResponse.json({ success: true, summary })
  } catch (err) {
    console.error("[v0] review summary error:", err)
    return NextResponse.json({ error: "Errore durante il riepilogo recensioni." }, { status: 500 })
  }
}
