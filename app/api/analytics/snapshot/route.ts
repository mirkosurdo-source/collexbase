import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { generateDailySnapshot, getValueTrendSeries } from "@/lib/analytics"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    // Persisting today's snapshot powers usage streaks and 7/30-day trends.
    const [snapshot, series] = await Promise.all([generateDailySnapshot(userId), getValueTrendSeries(userId)])

    return NextResponse.json({ success: true, snapshot, series })
  } catch (error) {
    console.error("[v0] Errore analytics snapshot:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
