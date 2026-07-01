import { NextResponse } from "next/server"
import { getSellerReliability } from "@/lib/reviews"

export const dynamic = "force-dynamic"

/**
 * Blocco 28 — seller reliability for the AI advisor: trusted (alto rating) e
 * rischiosi (basso rating), su recensioni di tipo venditore. Read-only.
 */
export async function GET() {
  try {
    const { trusted, risky } = await getSellerReliability(6)
    return NextResponse.json({ success: true, trusted, risky })
  } catch (err) {
    console.error("[v0] reviews/reliability error:", err)
    return NextResponse.json({ error: "Errore durante il calcolo dell'affidabilità." }, { status: 500 })
  }
}
