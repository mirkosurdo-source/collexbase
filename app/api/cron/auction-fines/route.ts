import { NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron-auth"
import { runFineSweep } from "@/lib/auction-fines"

// Cron: applies the CollexCoin fine and unlocks the seller's product for live
// auctions whose 48h payment window has expired unpaid. Blocco 51.
// Scheduled in vercel.json; safe to call repeatedly (idempotent via fineApplied).
async function handle(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, message: "Non autorizzato." }, { status: 401 })
  }
  try {
    const result = await runFineSweep()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[v0] auction-fines cron error:", error)
    return NextResponse.json({ ok: false, message: "Errore interno." }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
