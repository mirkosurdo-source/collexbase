import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCreatorDashboard, buildReferralLinkForCode } from "@/lib/creator-affiliate"

// GET /api/creator/dashboard — the caller's creator dashboard (creator only).
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }

  const dashboard = await getCreatorDashboard(userId)
  if (!dashboard) {
    return NextResponse.json({ ok: false, isCreator: false, error: "Non sei un Creator Partner." }, { status: 403 })
  }

  const origin = new URL(req.url).origin
  return NextResponse.json({
    ok: true,
    isCreator: true,
    link: buildReferralLinkForCode(dashboard.referralCode, origin),
    ...dashboard,
  })
}
