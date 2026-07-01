import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { listApplications } from "@/lib/creator-applications"

// GET /api/admin/creator/applications?status=pending|approved|rejected (admin only)
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const status = new URL(req.url).searchParams.get("status") || undefined
  const applications = await listApplications({ status })
  return NextResponse.json({ ok: true, applications })
}
