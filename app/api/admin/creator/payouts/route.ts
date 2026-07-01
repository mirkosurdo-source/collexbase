import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { listPayoutRequests, decidePayoutRequest } from "@/lib/creator-affiliate"
import User from "@/lib/models/User"

// GET /api/admin/creator/payouts?status=pending (admin only) — payout requests.
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const url = new URL(req.url)
  const status = url.searchParams.get("status") || undefined
  const requests = await listPayoutRequests({ status, limit: 200 })

  // Enrich with the requesting creator's username/email for the admin table.
  const ids = [...new Set(requests.map((r) => r.creatorId))]
  const users = await User.find({ _id: { $in: ids } }).select("username email").lean()
  const byId = new Map(
    users.map((u) => [String((u as { _id: unknown })._id), u as { username?: string; email?: string }]),
  )
  const enriched = requests.map((r) => {
    const u = byId.get(r.creatorId)
    return { ...r, username: u?.username || "Utente", email: u?.email || "" }
  })

  return NextResponse.json({ ok: true, requests: enriched })
}

// POST /api/admin/creator/payouts (admin only) — decide a request.
// Body: { requestId, approve: boolean, note? }
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  let body: { requestId?: string; approve?: boolean; note?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 })
  }

  const requestId = (body.requestId || "").trim()
  if (!requestId) {
    return NextResponse.json({ ok: false, error: "ID richiesta mancante." }, { status: 400 })
  }

  const result = await decidePayoutRequest({
    requestId,
    approve: Boolean(body.approve),
    note: (body.note || "").trim(),
  })
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result)
}
