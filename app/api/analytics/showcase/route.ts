import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getShowcaseTrendOverview } from "@/lib/analytics"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const showcase = await getShowcaseTrendOverview()
    return NextResponse.json({ success: true, ...showcase })
  } catch (error) {
    console.error("[v0] Errore analytics showcase:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
