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

/**
 * Promotes a user to admin. Requires the caller to already be an admin.
 * The first admin can be bootstrapped with the `x-admin-secret` header
 * (matching ADMIN_SECRET) or by listing their id in ADMIN_USER_IDS.
 */
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
      { success: false, message: "Specifica userId, username o email dell'utente da promuovere." },
      { status: 400 },
    )
  }

  await connectDB()
  const target = await findTarget(body)
  if (!target) {
    return NextResponse.json({ success: false, message: "Utente non trovato." }, { status: 404 })
  }

  target.role = "admin"
  await target.save()

  return NextResponse.json({
    success: true,
    message: `${target.username} è ora amministratore.`,
    user: { id: String(target._id), username: target.username, email: target.email, role: target.role },
  })
}
