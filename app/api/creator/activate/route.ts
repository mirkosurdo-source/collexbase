import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { isValidObjectId } from "mongoose"
import User from "@/lib/models/User"
import CreatorPartner from "@/lib/models/CreatorPartner"
import { activateCreator } from "@/lib/creator-affiliate"

// GET /api/creator/activate (admin only) — list all creator partners for the admin panel.
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  const partners = await CreatorPartner.find().sort({ createdAt: -1 }).limit(200).lean()
  const ids = partners.map((p) => String((p as { creatorId: unknown }).creatorId))
  const users = await User.find({ _id: { $in: ids } }).select("username email").lean()
  const byId = new Map(users.map((u) => [String((u as { _id: unknown })._id), u as { username?: string; email?: string }]))

  const creators = partners.map((p) => {
    const doc = p as {
      creatorId: unknown
      referralCode: string
      commissionRate: number
      commissionDurationMonths: number
      creditsBalance: number
      totalCreditsEarned: number
      totalUsersInvited: number
      active: boolean
    }
    const u = byId.get(String(doc.creatorId))
    return {
      creatorId: String(doc.creatorId),
      username: u?.username || "Utente",
      email: u?.email || "",
      referralCode: doc.referralCode,
      commissionRate: doc.commissionRate,
      commissionDurationMonths: doc.commissionDurationMonths,
      creditsBalance: doc.creditsBalance,
      totalCreditsEarned: doc.totalCreditsEarned,
      totalUsersInvited: doc.totalUsersInvited,
      active: doc.active,
    }
  })

  return NextResponse.json({ ok: true, creators })
}

// POST /api/creator/activate (admin only)
// Body: { creatorId, commissionRate?, commissionDurationMonths? }
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

  let body: { creatorId?: string; commissionRate?: number; commissionDurationMonths?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 })
  }

  const creatorId = (body.creatorId || "").trim()
  if (!isValidObjectId(creatorId)) {
    return NextResponse.json({ ok: false, error: "creatorId non valido." }, { status: 400 })
  }
  const user = await User.findById(creatorId).select("_id").lean()
  if (!user) return NextResponse.json({ ok: false, error: "Utente non trovato." }, { status: 404 })

  const rate =
    typeof body.commissionRate === "number" && body.commissionRate > 0 && body.commissionRate <= 1
      ? body.commissionRate
      : undefined
  const months =
    typeof body.commissionDurationMonths === "number" && body.commissionDurationMonths > 0
      ? Math.round(body.commissionDurationMonths)
      : undefined

  const partner = await activateCreator({ creatorId, commissionRate: rate, commissionDurationMonths: months })

  return NextResponse.json({
    ok: true,
    creator: {
      creatorId: partner.creatorId,
      referralCode: partner.referralCode,
      commissionRate: partner.commissionRate,
      commissionDurationMonths: partner.commissionDurationMonths,
      active: partner.active,
    },
  })
}
