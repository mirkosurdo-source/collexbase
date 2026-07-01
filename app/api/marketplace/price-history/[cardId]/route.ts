import { NextResponse } from "next/server"
import { getPriceHistory } from "@/lib/marketplace2"

export async function GET(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const { cardId } = await params
    if (!cardId) {
      return NextResponse.json({ success: false, message: "Carta mancante." }, { status: 400 })
    }
    const { searchParams } = new URL(req.url)
    const rangeRaw = Number(searchParams.get("range")) || 30
    const range = [7, 30, 90].includes(rangeRaw) ? rangeRaw : 30

    const history = await getPriceHistory(decodeURIComponent(cardId), range)
    return NextResponse.json({ success: true, history })
  } catch (error) {
    console.error("[v0] price-history error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
