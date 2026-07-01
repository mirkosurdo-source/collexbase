import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import { connectDB } from "@/lib/db"
import Webhook from "@/lib/models/Webhook"

// DELETE /api/developer/webhooks/[id] — remove one of the user's webhooks.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = getAuthUserId(req)
  if (!userId) return NextResponse.json({ success: false, message: "Non autorizzato." }, { status: 401 })
  const { id } = await params
  try {
    await connectDB()
    const res = await Webhook.deleteOne({ _id: id, userId })
    if (res.deletedCount === 0) {
      return NextResponse.json({ success: false, message: "Webhook non trovato." }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] developer/webhooks DELETE error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
