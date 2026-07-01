import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { approveApplication } from "@/lib/creator-applications"

// POST /api/admin/creator/applications/[id]/approve (admin only)
// Body (optional): { commissionRate?, commissionDurationMonths? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id } = await params

  let body: { commissionRate?: number; commissionDurationMonths?: number } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const rate =
    typeof body.commissionRate === "number" && body.commissionRate > 0 && body.commissionRate <= 1
      ? body.commissionRate
      : undefined
  const months =
    typeof body.commissionDurationMonths === "number" && body.commissionDurationMonths > 0
      ? Math.round(body.commissionDurationMonths)
      : undefined

  const result = await approveApplication({
    applicationId: id,
    adminId: auth.admin!.userId,
    commissionRate: rate,
    commissionDurationMonths: months,
  })

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
