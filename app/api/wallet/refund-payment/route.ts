import { NextResponse } from "next/server"
import Escrow from "@/lib/models/Escrow"
import { connectDB } from "@/lib/db"
import { getAuthUserId } from "@/lib/auth/request"
import { refundPayment } from "@/lib/escrow"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }

    const body = await req.json()
    const { escrowId } = body
    if (!escrowId) {
      return NextResponse.json({ success: false, message: "ID deposito mancante." }, { status: 400 })
    }

    await connectDB()
    const escrow = await Escrow.findById(escrowId)
    if (!escrow) {
      return NextResponse.json({ success: false, message: "Deposito non trovato." }, { status: 404 })
    }
    // Buyer can request a refund; seller can grant one.
    if (String(escrow.buyerId) !== userId && String(escrow.sellerId) !== userId) {
      return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 403 })
    }

    const result = await refundPayment(escrowId)
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: result.message, escrow: result.escrow })
  } catch (error) {
    console.error("[v0] wallet/refund-payment error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
