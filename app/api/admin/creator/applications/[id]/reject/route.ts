import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { rejectApplication } from "@/lib/creator-applications"

// POST /api/admin/creator/applications/[id]/reject (admin only)
// Body (optional): { note? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id } = await params

  let body: { note?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const result = await rejectApplication({
    applicationId: id,
    adminId: auth.admin!.userId,
    note: body.note || "",
  })

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
