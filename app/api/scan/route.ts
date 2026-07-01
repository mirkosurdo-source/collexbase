import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { scanSingle, scanMultiple } from "@/lib/scan"
import { AIError } from "@/lib/ai-valuation"

export const maxDuration = 120

/**
 * Blocco 35 — Scanner intelligente.
 *
 * POST { mode: "single" | "multi", imageUrl: string, category?: string }
 *
 * Stateless instant valuation for the mobile app. Requires auth but writes
 * NOTHING to the database — adding scanned items to the collection is a
 * separate, explicit user action via the existing collection endpoints.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const mode = body.mode === "multi" ? "multi" : "single"
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : ""
    const category = typeof body.category === "string" ? body.category : undefined

    if (!imageUrl) {
      return NextResponse.json({ success: false, message: "Immagine mancante." }, { status: 400 })
    }

    if (mode === "multi") {
      const result = await scanMultiple(imageUrl, category)
      return NextResponse.json({ success: true, mode, ...result })
    }

    const result = await scanSingle(imageUrl, category)
    return NextResponse.json({ success: true, mode, ...result })
  } catch (error) {
    if (error instanceof AIError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status })
    }
    console.error("[v0] scan error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
