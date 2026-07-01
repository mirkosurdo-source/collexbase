import { NextResponse } from "next/server"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"
import { requireAdmin } from "@/lib/admin"

/**
 * Reports whether the logged-in user is an admin. Intended for UI gating —
 * always returns 200 with an `isAdmin` boolean (never throws a 403), so the
 * navbar/page can decide what to render without treating denial as an error.
 */
export async function GET(req: Request) {
  const userId = getAuthUserId(req)
  if (!userId) {
    return NextResponse.json({ isAdmin: false, authenticated: false })
  }

  await connectDB()
  const user = await User.findById(userId).select("username email role blocked")
  if (!user) {
    return NextResponse.json({ isAdmin: false, authenticated: false })
  }

  // Reuse the central admin policy (role + env allow-list + secret header).
  const adminRes = await requireAdmin(req)

  return NextResponse.json({
    authenticated: true,
    isAdmin: adminRes.ok,
    role: user.role || "user",
    blocked: Boolean(user.blocked),
    user: { id: String(user._id), username: user.username || "", email: user.email || "" },
  })
}
