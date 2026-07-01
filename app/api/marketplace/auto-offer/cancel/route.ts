import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { cancelAutoOffer } from "@/lib/marketplace2"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }
    const body = await req.json()
    const { autoOfferId } = body
    if (!autoOfferId) {
      return NextResponse.json({ success: false, message: "ID auto-offerta mancante." }, { status: 400 })
    }
    const ok = await cancelAutoOffer(userId, String(autoOfferId))
    if (!ok) {
      return NextResponse.json({ success: false, message: "Auto-offerta non trovata." }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Auto-offerta annullata." })
  } catch (error) {
    console.error("[v0] auto-offer/cancel error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
