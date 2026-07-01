import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import StripeEscrow from "@/lib/models/StripeEscrow"
import { releaseEscrow } from "@/lib/stripe/connect"
import { isAuthorizedCron } from "@/lib/cron-auth"

/**
 * GET /api/cron/auto-release
 * Releases every escrow whose 48h window has elapsed and that is still pending.
 * Wired to a Vercel Cron (see vercel.json). Idempotent: already-released or
 * failed-transfer escrows are skipped/left for the next run.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 })
  }

  await connectDB()

  const due = await StripeEscrow.find({
    released: false,
    autoReleaseAt: { $lte: new Date() },
  }).limit(100)

  let released = 0
  let failed = 0
  for (const escrow of due) {
    try {
      const result = await releaseEscrow(escrow)
      if (result.ok) released++
      else failed++
    } catch {
      // Leave it for the next sweep (e.g. seller not yet payouts-enabled).
      failed++
    }
  }

  return NextResponse.json({ released, failed, scanned: due.length })
}
