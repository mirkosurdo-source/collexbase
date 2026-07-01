import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreator } from "@/lib/creator-affiliate"
import { getDaily } from "@/lib/creator-analytics"

// GET /api/creator/analytics/daily?days=30 — daily time series (max 90).
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })

  const partner = await getCreator(userId)
  if (!partner) return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })

  const daysParam = new URL(req.url).searchParams.get("days")
  const days = Math.max(1, Math.min(90, daysParam ? Number(daysParam) : 30))
  const series = await getDaily(userId, days)
  return NextResponse.json({ ok: true, series })
}
