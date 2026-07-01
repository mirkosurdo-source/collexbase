import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getValueTrendSeries, getCollectionSnapshot } from "@/lib/analytics"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const [series, snapshot] = await Promise.all([getValueTrendSeries(userId), getCollectionSnapshot(userId)])
    return NextResponse.json({
      success: true,
      series,
      trend7d: snapshot.trend7d,
      trend30d: snapshot.trend30d,
    })
  } catch (error) {
    console.error("[v0] Errore analytics trends:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
