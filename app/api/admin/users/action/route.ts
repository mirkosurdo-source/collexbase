import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { requireAdmin } from "@/lib/admin"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { createNotification } from "@/lib/notifications"

export const dynamic = "force-dynamic"

/**
 * Admin user actions:
 *  - block / unblock     : toggle account access
 *  - set_role            : promote/demote (user | admin)
 *  - reset_password      : set a generated temp password, returned once
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const body = await req.json()
    const action = String(body.action || "")
    const targetId = String(body.userId || "")
    if (!targetId) return NextResponse.json({ success: false, message: "userId mancante." }, { status: 400 })

    await connectDB()
    const user = await User.findById(targetId).select("username role blocked")
    if (!user) return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })

    // Operators cannot lock themselves out or demote their own admin role.
    if (auth.admin && String(targetId) === auth.admin.userId && (action === "block" || action === "set_role")) {
      return NextResponse.json({ success: false, message: "Non puoi modificare il tuo stesso account admin." }, { status: 400 })
    }

    if (action === "block" || action === "unblock") {
      user.blocked = action === "block"
      await user.save()
      await createNotification({
        userId: targetId,
        type: "system",
        title: action === "block" ? "Account sospeso" : "Account riattivato",
        body:
          action === "block"
            ? "Il tuo account è stato sospeso da un amministratore."
            : "Il tuo account è stato riattivato.",
        link: "/",
      })
      return NextResponse.json({ success: true, blocked: user.blocked, message: "Stato aggiornato." })
    }

    if (action === "set_role") {
      const role = String(body.role || "")
      if (role !== "user" && role !== "admin") {
        return NextResponse.json({ success: false, message: "Ruolo non valido." }, { status: 400 })
      }
      user.role = role
      await user.save()
      return NextResponse.json({ success: true, role, message: "Ruolo aggiornato." })
    }

    if (action === "reset_password") {
      const temp = Math.random().toString(36).slice(2, 10) + "A1!"
      user.password = await bcrypt.hash(temp, 10)
      await user.save()
      return NextResponse.json({ success: true, tempPassword: temp, message: "Password reimpostata." })
    }

    return NextResponse.json({ success: false, message: "Azione non riconosciuta." }, { status: 400 })
  } catch (err) {
    console.error("[v0] admin/users/action error:", err)
    return NextResponse.json({ success: false, message: "Errore del server." }, { status: 500 })
  }
}
