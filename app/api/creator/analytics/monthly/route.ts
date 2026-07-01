import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreator } from "@/lib/creator-affiliate"
import { getMonthly } from "@/lib/creator-analytics"

// GET /api/creator/analytics/monthly?months=12 — monthly time series (max 24).
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })

  const partner = await getCreator(userId)
  if (!partner) return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })

  const monthsParam = new URL(req.url).searchParams.get("months")
  const months = Math.max(1, Math.min(24, monthsParam ? Number(monthsParam) : 12))
  const series = await getMonthly(userId, months)
  return NextResponse.json({ ok: true, series })
}
