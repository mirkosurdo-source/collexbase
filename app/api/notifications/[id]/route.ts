import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import Notification from "@/lib/models/Notification"
import { verifyToken } from "@/lib/auth/jwt"

export const dynamic = "force-dynamic"

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) return authHeader.slice(7)
  return null
}

/** Soft-deletes a single notification (scoped to the owner). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = extractToken(req)
    if (!token) return NextResponse.json({ success: false, message: "Token mancante." }, { status: 401 })

    const decoded = verifyToken(token)
    if (!decoded) return NextResponse.json({ success: false, message: "Token non valido o scaduto." }, { status: 401 })

    const { id } = await params
    if (!id) return NextResponse.json({ success: false, message: "ID notifica mancante." }, { status: 400 })

    await connectDB()

    // Scope by userId so a user can only delete their own notifications.
    const updated = await Notification.findOneAndUpdate(
      { _id: id, userId: decoded.userId },
      { deleted: true },
      { new: true },
    )

    if (!updated) return NextResponse.json({ success: false, message: "Notifica non trovata." }, { status: 404 })

    const unreadCount = await Notification.countDocuments({
      userId: decoded.userId,
      deleted: { $ne: true },
      read: false,
    })

    return NextResponse.json({ success: true, message: "Notifica eliminata.", unreadCount })
  } catch (error) {
    console.error("[v0] DELETE notification error:", error)
    return NextResponse.json({ success: false, message: "Errore interno del server." }, { status: 500 })
  }
}
