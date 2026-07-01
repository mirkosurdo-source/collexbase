import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getApplicationStatus } from "@/lib/creator-applications"

// GET /api/creator/application-status — the caller's application + creator state.
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Autenticazione richiesta." }, { status: 401 })
  }

  const status = await getApplicationStatus(userId)
  return NextResponse.json({ ok: true, ...status })
}
