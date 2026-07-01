import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { recommendGroups } from "@/lib/groups"

/** GET /api/groups/recommended — personalized group suggestions (AI Advisor). */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    const { searchParams } = new URL(req.url)
    const limit = Math.min(12, Math.max(1, Number(searchParams.get("limit")) || 6))
    const groups = await recommendGroups(userId, limit)
    return NextResponse.json({ success: true, groups })
  } catch (error) {
    console.error("[v0] groups recommended error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
