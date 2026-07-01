import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { createAlert } from "@/lib/marketplace2"

const DIRECTIONS = ["above", "below", "reaches", "swing"] as const

export async function POST(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })
    }
    const body = await req.json()
    const { cardId, label, targetPrice, direction } = body
    if (!cardId || !DIRECTIONS.includes(direction)) {
      return NextResponse.json({ success: false, message: "Dati alert non validi." }, { status: 400 })
    }

    const result = await createAlert({
      userId,
      cardId: String(cardId),
      label: label ? String(label) : undefined,
      targetPrice: Number(targetPrice) || 0,
      direction,
    })
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ success: true, message: result.message, alert: result.alert })
  } catch (error) {
    console.error("[v0] price-alert/create error:", error)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
