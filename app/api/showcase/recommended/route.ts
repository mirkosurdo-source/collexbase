import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getRecommendedShowcases } from "@/lib/showcase"

/** GET /api/showcase/recommended — AI-advisor recommended showcases. */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, error: "Non autorizzato" }, { status: 401 })
    const showcases = await getRecommendedShowcases(userId, 6)
    return NextResponse.json({ success: true, showcases })
  } catch (error) {
    console.error("[v0] GET /api/showcase/recommended error:", error)
    return NextResponse.json({ success: false, error: "Errore del server" }, { status: 500 })
  }
}
