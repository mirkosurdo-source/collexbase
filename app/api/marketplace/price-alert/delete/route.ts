import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { deleteAlert } from "@/lib/marketplace2"

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }
    const body = await req.json()
    const { alertId } = body
    if (!alertId) {
      return NextResponse.json({ success: false, message: "ID alert mancante." }, { status: 400 })
    }
    const ok = await deleteAlert(userId, String(alertId))
    if (!ok) {
      return NextResponse.json({ success: false, message: "Alert non trovato." }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: "Alert eliminato." })
  } catch (error) {
    console.error("[v0] price-alert/delete error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
