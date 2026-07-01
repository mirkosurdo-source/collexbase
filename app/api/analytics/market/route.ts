import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getMarketOverview } from "@/lib/analytics"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const market = await getMarketOverview()
    return NextResponse.json({ success: true, ...market })
  } catch (error) {
    console.error("[v0] Errore analytics market:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
