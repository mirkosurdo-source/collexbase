import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { deactivateCreator } from "@/lib/creator-affiliate"

// POST /api/creator/deactivate (admin only) — Body: { creatorId }
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  let body: { creatorId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 })
  }

  const creatorId = (body.creatorId || "").trim()
  const partner = await deactivateCreator(creatorId)
  if (!partner) return NextResponse.json({ ok: false, error: "Creator non trovato." }, { status: 404 })

  return NextResponse.json({ ok: true, active: partner.active })
}
