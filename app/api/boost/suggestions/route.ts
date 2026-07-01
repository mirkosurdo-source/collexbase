import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getBoostSuggestions } from "@/lib/boost"

/** Advisor "Strategia Boost": which of the user's items are worth boosting. */
export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }
    const suggestions = await getBoostSuggestions(userId, 6)
    return NextResponse.json({ success: true, suggestions })
  } catch (error) {
    console.error("[v0] boost/suggestions error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
