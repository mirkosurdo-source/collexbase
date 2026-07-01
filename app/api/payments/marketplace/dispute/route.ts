import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { disputeEscrow } from "@/lib/payments"
import PaymentEscrow from "@/lib/models/PaymentEscrow"
import { connectDB } from "@/lib/db"

/**
 * Opens a dispute on a held escrow. Either party (buyer or seller) may dispute,
 * which freezes the funds until resolution.
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    await connectDB()
    const body = await req.json()
    const escrow = await PaymentEscrow.findById(body.escrowId)
    if (!escrow) return NextResponse.json({ error: "Escrow non trovato." }, { status: 404 })

    const isParty = String(escrow.buyerId) === userId || String(escrow.sellerId) === userId
    if (!isParty) return NextResponse.json({ error: "Non autorizzato." }, { status: 403 })

    const result = await disputeEscrow(String(escrow._id), String(body.reason || ""))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[v0] dispute error:", err)
    return NextResponse.json({ error: "Errore durante l'apertura della disputa." }, { status: 500 })
  }
}
