import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getSellerProfile, refreshConnectStatus, serializeProfile } from "@/lib/seller"

// GET /api/seller/profile — the caller's own seller profile (refreshes Stripe).
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

  const profile = await getSellerProfile(userId)
  if (!profile) return NextResponse.json({ success: true, profile: null })

  const refreshed = (await refreshConnectStatus(userId)) || profile
  return NextResponse.json({ success: true, profile: serializeProfile(refreshed) })
}
