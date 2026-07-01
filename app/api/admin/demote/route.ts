import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { requireAdmin } from "@/lib/admin"

/** Resolves a target user from an id, username, or email payload. */
async function findTarget(body: { userId?: string; username?: string; email?: string }) {
  if (body.userId) return User.findById(body.userId).select("username email role")
  if (body.username) return User.findOne({ username: body.username }).select("username email role")
  if (body.email) return User.findOne({ email: String(body.email).toLowerCase() }).select("username email role")
  return null
}

/** Demotes an admin back to a regular user. Requires the caller to be an admin. */
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
  }

  let body: { userId?: string; username?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, message: "Corpo della richiesta non valido." }, { status: 400 })
  }

  if (!body.userId && !body.username && !body.email) {
    return NextResponse.json(
      { success: false, message: "Specifica userId, username o email dell'utente da declassare." },
      { status: 400 },
    )
  }

  await connectDB()
  const target = await findTarget(body)
  if (!target) {
    return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
  }

  // Prevent an admin from demoting themselves and losing access by accident.
  if (auth.admin && String(target._id) === auth.admin.userId) {
    return NextResponse.json(
      { success: false, message: "Non puoi declassare il tuo stesso account." },
      { status: 400 },
    )
  }

  target.role = "user"
  await target.save()

  return NextResponse.json({
    success: true,
    message: `${target.username} è ora un utente standard.`,
    user: { id: String(target._id), username: target.username, email: target.email, role: target.role },
  })
}
