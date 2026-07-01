import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { testWebhook } from "@/lib/webhooks"

// POST /api/developer/webhooks/[id]/test — send a signed test ping.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 401 })
  const { id } = await params
  try {
    const result = await testWebhook(id, userId)
    if (!result) return NextResponse.json({ success: false, message: "Webhook non trovato." }, { status: 404 })
    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error("[v0] developer/webhooks test error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
