import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import { getAuthUserId } from "@/lib/auth/request"

export interface AdminContext {
  userId: string
  username: string
  email: string
}

export interface AdminResult {
  ok: boolean
  status: number
  error?: string
  admin?: AdminContext
}

/**
 * Returns the configured env-based admin allow-list. An operator id in this
 * list is always treated as an admin even before any User.role is set, which
 * lets the very first admin bootstrap the panel.
 */
function envAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Authorizes an admin-only request. An operator is an admin if:
 *  - their User.role === "admin", OR
 *  - their id is in ADMIN_USER_IDS, OR
 *  - the request carries x-admin-secret matching ADMIN_SECRET.
 *
 * Blocked users are always rejected.
 */
export async function requireAdmin(req: Request): Promise<AdminResult> {
  const secret = process.env.ADMIN_SECRET
  const header = req.headers.get("x-admin-secret")
  const userId = getAuthUserId(req)

  if (!userId) {
    // Allow a pure-secret operator (e.g. server-to-server) when configured.
    if (secret && header && header === secret) {
      return { ok: true, status: 200, admin: { userId: "system", username: "system", email: "" } }
    }
    return { ok: false, status: 401, error: "Non autenticato." }
  }

  await connectDB()
  const user = await User.findById(userId).select("username email role blocked")
  if (!user) return { ok: false, status: 401, error: "Utente non trovato." }
  if (user.blocked) return { ok: false, status: 403, error: "Account bloccato." }

  const isAdmin =
    user.role === "admin" ||
    envAdminIds().includes(userId) ||
    Boolean(secret && header && header === secret)

  if (!isAdmin) return { ok: false, status: 403, error: "Accesso riservato agli amministratori." }

  return {
    ok: true,
    status: 200,
    admin: { userId, username: user.username || "", email: user.email || "" },
  }
}

/** Convenience boolean check (no error payload). */
export async function isAdmin(req: Request): Promise<boolean> {
  const res = await requireAdmin(req)
  return res.ok
}
