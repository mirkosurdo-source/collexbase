import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { getCollectionSnapshot } from "@/lib/analytics"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) return NextResponse.json({ success: false, message: "Non autenticato." }, { status: 401 })

    const snapshot = await getCollectionSnapshot(userId)
    return NextResponse.json({ success: true, categories: snapshot.categories, totalValue: snapshot.totalValue })
  } catch (error) {
    console.error("[v0] Errore analytics categories:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
