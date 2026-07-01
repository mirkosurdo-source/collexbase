import { NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron-auth"
import { runReminderSweep } from "@/lib/auction-fines"

// Cron: fires the 24h / 46h payment reminders for won live auctions. Blocco 51.
// Scheduled in vercel.json; safe to call repeatedly (idempotent).
async function handle(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, message: "Non autorizzato." }, { status: 401 })
  }
  try {
    const result = await runReminderSweep()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[v0] auction-reminders cron error:", error)
    return NextResponse.json({ ok: false, message: "Errore interno." }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
