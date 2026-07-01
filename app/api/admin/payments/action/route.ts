import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import { releaseEscrow, refundEscrow, disputeEscrow } from "@/lib/payments"

export const dynamic = "force-dynamic"

/**
 * Admin escrow resolution (reuses the Blocco 16 escrow lifecycle helpers):
 *  - release  : confirm delivery, pay the seller
 *  - refund   : refund the buyer via Stripe and unwind the escrow
 *  - dispute  : freeze funds and open a dispute
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const action = String(body.action || "")
    const escrowId = String(body.escrowId || "")
    if (!escrowId) return NextResponse.json({ success: false, message: "escrowId mancante." }, { status: 400 })

    await connectDB()

    let result: { ok: boolean; error?: string }
    if (action === "release") {
      result = await releaseEscrow(escrowId)
    } else if (action === "refund") {
      result = await refundEscrow(escrowId)
    } else if (action === "dispute") {
      result = await disputeEscrow(escrowId, String(body.reason || "Disputa aperta dall'amministrazione"))
    } else {
      return NextResponse.json({ success: false, message: "Azione non riconosciuta." }, { status: 400 })
    }

    if (!result.ok) return NextResponse.json({ success: false, message: result.error }, { status: 400 })
    return NextResponse.json({ success: true, message: "Operazione completata." })
  } catch (err) {
    console.error("[v0] admin/payments/action error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
