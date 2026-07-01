import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { decidePayoutRequest } from "@/lib/creator-affiliate"

// POST /api/admin/creator/payouts/[id]/approve — approve + (Stripe) transfer.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const result = await decidePayoutRequest({
    requestId: id,
    approve: true,
    note: (body.note || "").trim(),
    reviewedBy: auth.admin?.userId,
  })
  if (!result.ok) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
