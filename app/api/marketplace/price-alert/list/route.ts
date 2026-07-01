import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { listAlerts } from "@/lib/marketplace2"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }
    const alerts = (await listAlerts(userId)).map((a: Record<string, unknown>) => ({
      ...a,
      _id: String(a._id),
      userId: String(a.userId),
    }))
    return NextResponse.json({ success: true, alerts })
  } catch (error) {
    console.error("[v0] price-alert/list error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
