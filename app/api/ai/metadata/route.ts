import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import AIMetadata from "@/lib/models/AIMetadata"

export async function GET(req: Request) {
  try {
    const userId = getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ success: false, message: "Autenticazione richiesta." }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const objectId = searchParams.get("objectId")
    if (!objectId) {
      return NextResponse.json({ success: false, message: "objectId mancante." }, { status: 400 })
    }

    await connectDB()
    const metadata = await AIMetadata.findOne({ objectId, userId }).lean()

    // Not an error: the item simply hasn't been analyzed yet.
    return NextResponse.json({ success: true, metadata: metadata || null })
  } catch (error) {
    console.error("[v0] ai/metadata error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
