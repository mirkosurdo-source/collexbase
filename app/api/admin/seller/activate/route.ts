import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { activateSeller, serializeProfile } from "@/lib/seller"

// POST /api/admin/seller/activate { userId, commissionRate? } — admin only.
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()
  if (!userId) return NextResponse.json({ success: false, message: "userId mancante." }, { status: 400 })

  const rate = typeof body.commissionRate === "number" ? body.commissionRate : undefined
  const res = await activateSeller({ userId, commissionRate: rate })
  if (!res.ok || !res.profile)
    return NextResponse.json({ success: false, message: res.error || "Errore." }, { status: 400 })

  return NextResponse.json({ success: true, profile: serializeProfile(res.profile) })
}
