import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { createAutoOffer } from "@/lib/marketplace2"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }
    const body = await req.json()
    const { listingId, maxPrice } = body
    if (!listingId || !Number(maxPrice)) {
      return NextResponse.json({ success: false, message: "Dati auto-offerta non validi." }, { status: 400 })
    }
    const result = await createAutoOffer({ userId, listingId: String(listingId), maxPrice: Number(maxPrice) })
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ success: true, message: result.message, autoOffer: result.autoOffer })
  } catch (error) {
    console.error("[v0] auto-offer/create error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
