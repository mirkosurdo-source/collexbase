import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getOrCreatePaymentWallet, adjustWallet, recordPayment, serializeWallet } from "@/lib/payments"
import PaymentProfile from "@/lib/models/PaymentProfile"
import { roundMoney } from "@/lib/fees"
import { createNotification } from "@/lib/notifications"

/** Basic IBAN sanity check (length + alphanumeric). Not a full validation. */
function looksLikeIban(v: string): boolean {
  const s = (v || "").replace(/\s+/g, "").toUpperCase()
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)
}

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ error: "Non autenticato." }, { status: 401 })

    const body = await req.json()
    const amount = roundMoney(Number(body.amount))
    const iban = String(body.iban || "").replace(/\s+/g, "").toUpperCase()

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Importo non valido." }, { status: 400 })
    }
    if (!looksLikeIban(iban)) {
      return NextResponse.json({ error: "IBAN non valido." }, { status: 400 })
    }

    const wallet = await getOrCreatePaymentWallet(userId)
    if (wallet.available < amount) {
      return NextResponse.json({ error: "Saldo disponibile insufficiente." }, { status: 400 })
    }

    // Debit available immediately; payout is processed asynchronously.
    await adjustWallet(userId, { available: -amount })
    await recordPayment({
      userId,
      kind: "withdraw",
      amount: -amount,
      status: "pending",
      description: `Prelievo verso IBAN ****${iban.slice(-4)}`,
    })

    // Cache masked IBAN for display.
    await PaymentProfile.findOneAndUpdate(
      { userId },
      { $set: { payoutIbanLast4: iban.slice(-4) } },
      { upsert: true },
    )

    await createNotification({
      userId,
      type: "system",
      title: "Prelievo richiesto",
      body: `Il tuo prelievo di € ${amount.toLocaleString("it-IT")} è in elaborazione.`,
      link: "/payments",
    })

    const updated = await getOrCreatePaymentWallet(userId)
    return NextResponse.json({ ok: true, wallet: serializeWallet(updated) })
  } catch (err) {
    console.error("[v0] withdraw error:", err)
    return NextResponse.json({ error: "Errore durante il prelievo." }, { status: 500 })
  }
}
