import { NextResponse } from "next/server"
import { getSellerRanking } from "@/lib/seller-ranking"

export async function GET(_req: Request, { params }: { params: Promise<{ sellerId: string }> }) {
  try {
    const { sellerId } = await params
    if (!sellerId) {
      return NextResponse.json({ success: false, message: "Venditore mancante." }, { status: 400 })
    }
    const ranking = await getSellerRanking(sellerId)
    return NextResponse.json({ success: true, ranking })
  } catch (error) {
    console.error("[v0] seller-ranking error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
