import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import ModerationEvent from "@/lib/models/ModerationEvent"
import User from "@/lib/models/User"
import { notifyModerationAction } from "@/lib/notifications"
import { notifyContentModerated } from "@/lib/moderation-notifications"

export const dynamic = "force-dynamic"

/**
 * Blocco 37 — remove a flagged content event. Marks the event as
 * `resolution: "removed"`, notifies the author, and (optionally, for critical
 * severity) suspends the offending account by setting User.blocked = true.
 *
 * Additive: it never deletes from any existing engine collection — the actual
 * content removal is left to each engine's own admin tools. This records the
 * moderation decision and, at most, blocks an abusive account.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const { id } = await params
    if (!id) return NextResponse.json({ success: false, message: "ID mancante." }, { status: 400 })

    const url = new URL(req.url)
    const suspend = url.searchParams.get("suspend") === "1"

    await connectDB()
    const event = await ModerationEvent.findById(id)
    if (!event) return NextResponse.json({ success: false, message: "Evento non trovato." }, { status: 404 })

    event.resolved = true
    event.resolution = "removed"
    event.autoActioned = true
    event.resolvedBy = auth.admin?.userId || "system"
    event.resolvedAt = new Date()
    await event.save()

    // Notify the author their content was removed.
    await notifyContentModerated(event.userId, event.targetType, event.reason || "Contenuto rimosso dalla moderazione.", true)

    let suspended = false
    if (suspend && event.userId) {
      try {
        await User.findByIdAndUpdate(event.userId, { blocked: true })
        await notifyModerationAction(event.userId, "Il tuo account è stato sospeso per violazione delle regole.", String(event._id))
        suspended = true
      } catch (e) {
        console.error("[v0] moderation remove suspend error:", e)
      }
    }

    return NextResponse.json({
      success: true,
      message: suspended ? "Contenuto rimosso e utente sospeso." : "Contenuto rimosso.",
    })
  } catch (err) {
    console.error("[v0] admin/moderation remove DELETE error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
