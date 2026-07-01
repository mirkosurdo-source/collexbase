import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import ModerationEvent from "@/lib/models/ModerationEvent"

export const dynamic = "force-dynamic"

/**
 * Blocco 37 — resolve (dismiss/handle) a moderation event. Marks it resolved
 * with `resolution: "resolved"` and records the operating admin. Additive: it
 * only touches the ModerationEvent collection.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const { id } = await params
    if (!id) return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })

    await connectDB()
    const event = await ModerationEvent.findById(id)
    if (!event) return NextResponse.json({ success: false, message: "Evento non trovato." }, { status: 404 })

    event.resolved = true
    event.resolution = "resolved"
    event.resolvedBy = auth.admin?.userId || "system"
    event.resolvedAt = new Date()
    await event.save()

    return NextResponse.json({ success: true, message: "Evento risolto." })
  } catch (err) {
    console.error("[v0] admin/moderation resolve PATCH error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
