import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreator } from "@/lib/creator-affiliate"
import { getOverview } from "@/lib/creator-analytics"

// GET /api/creator/analytics/overview?days=30 (omit days for all-time).
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })

  const partner = await getCreator(userId)
  if (!partner) return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })

  const daysParam = new URL(req.url).searchParams.get("days")
  const days = daysParam ? Math.max(1, Math.min(366, Number(daysParam))) : undefined
  const overview = await getOverview(userId, days)
  return NextResponse.json({ ok: true, overview })
}
