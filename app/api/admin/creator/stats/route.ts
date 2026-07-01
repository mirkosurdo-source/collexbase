import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getCreatorAdminStats } from "@/lib/creator-affiliate"

// GET /api/admin/creator/stats (admin only) — aggregate program metrics.
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const stats = await getCreatorAdminStats()
  return NextResponse.json({ ok: true, stats })
}
