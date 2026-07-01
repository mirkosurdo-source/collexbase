import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreatePaymentWallet, adjustWallet, recordPayment, serializeWallet } from "@/lib/payments"
import User from "@/lib/models/User"
import { roundMoney } from "@/lib/fees"
import { createNotification } from "@/lib/notifications"

/**
 * Internal marketplace transfer of available funds from the authenticated user
 * to another user (by id or username).
 */
export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    const body = await req.json()
    const amount = roundMoney(Number(body.amount))
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Importo non valido." }, { status: 400 })
    }

    // Resolve recipient by id or username.
    const query = body.toUserId ? { _id: body.toUserId } : { username: String(body.toUsername || "").trim() }
    const recipient = await User.findOne(query).select("_id username")
    if (!recipient) return NextResponse.json({ error: "Destinatario non trovato." }, { status: 404 })
    if (String(recipient._id) === userId) {
      return NextResponse.json({ error: "Non puoi trasferire a te stesso." }, { status: 400 })
    }

    const wallet = await getOrCreatePaymentWallet(userId)
    if (wallet.available < amount) {
      return NextResponse.json({ error: "Saldo disponibile insufficiente." }, { status: 400 })
    }

    const recipientId = String(recipient._id)
    await adjustWallet(userId, { available: -amount })
    await adjustWallet(recipientId, { available: amount })

    await recordPayment({
      userId,
      kind: "transfer_out",
      amount: -amount,
      counterpartyId: recipientId,
      description: `Trasferimento a @${recipient.username}`,
    })
    await recordPayment({
      userId: recipientId,
      kind: "transfer_in",
      amount,
      counterpartyId: userId,
      description: "Trasferimento ricevuto",
    })

    await createNotification({
      userId: recipientId,
      type: "system",
      title: "Fondi ricevuti",
      body: `Hai ricevuto € ${amount.toLocaleString("it-IT")} sul tuo wallet.`,
      link: "/payments",
    })

    const updated = await getOrCreatePaymentWallet(userId)
    return NextResponse.json({ ok: true, wallet: serializeWallet(updated) })
  } catch (err) {
    console.error("[v0] transfer error:", err)
    return NextResponse.json({ error: "Errore durante il trasferimento." }, { status: 500 })
  }
}
