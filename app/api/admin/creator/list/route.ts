import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { listCreators } from "@/lib/creator-affiliate"

// GET /api/admin/creator/list (admin only) — all creator partners.
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const creators = await listCreators()
  return NextResponse.json({ ok: true, creators })
}
