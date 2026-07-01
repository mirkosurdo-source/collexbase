import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import { getReferralStats, buildReferralLink } from "@/lib/referral"
import ReferralEvent from "@/lib/models/ReferralEvent"
import User from "@/lib/models/User"

// GET /api/referral/stats — the caller's referral performance + share link.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }

  await connectDB()
  const origin = new URL(req.url).origin
  const base = await getReferralStats(userId)

  // Resolve invited usernames + confirmation status for display.
  const events = await ReferralEvent.find({ inviterId: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  const invitedIds = events.map((e) => String((e as { invitedId: string }).invitedId))
  const users = await User.find({ _id: { $in: invitedIds } })
    .select("username")
    .lean()
  const nameById = new Map(users.map((u) => [String((u as { _id: unknown })._id), (u as { username?: string }).username]))

  let confirmedInvites = 0
  const invites = events.map((e) => {
    const ev = e as { invitedId: string; method?: string; coinsRewarded?: boolean; createdAt?: Date }
    if (ev.coinsRewarded) confirmedInvites++
    return {
      username: nameById.get(String(ev.invitedId)) || "Utente",
      status: ev.coinsRewarded ? "confirmed" : "pending",
      method: ev.method ?? "link",
      createdAt: new Date(ev.createdAt ?? Date.now()).toISOString(),
    }
  })

  return NextResponse.json({
    ok: true,
    stats: {
      code: userId,
      link: buildReferralLink(userId, origin),
      totalInvites: base.totalInvites,
      confirmedInvites,
      coinsEarned: base.coinsEarned,
      invites,
    },
  })
}
