import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { recordTransaction } from "@/lib/collexcoin"

export const dynamic = "force-dynamic"

/** Admin add/remove of Collex Coin. `amount` is signed; target by id or username. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ success: false, message: "Importo non valido." }, { status: 400 })
    }

    await connectDB()
    let targetId = typeof body.userId === "string" ? body.userId : ""
    if (!targetId && typeof body.username === "string") {
      const target = await User.findOne({ username: body.username }).select("_id")
      if (!target) return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
      targetId = String(target._id)
    }
    if (!targetId) return NextResponse.json({ success: false, message: "Specifica userId o username." }, { status: 400 })

    const result = await recordTransaction({
      userId: targetId,
      amount,
      type: "manual_adjustment",
      description: typeof body.description === "string" && body.description ? body.description : "Rettifica amministrativa",
      allowNegative: false,
    })
    if (!result.ok) return NextResponse.json({ success: false, message: result.error }, { status: 400 })

    return NextResponse.json({ success: true, balance: result.balance, message: "Saldo aggiornato." })
  } catch (err) {
    console.error("[v0] admin/coins/action error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
