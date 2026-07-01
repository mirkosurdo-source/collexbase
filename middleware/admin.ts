import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"

/**
 * Admin route guard for CollexBase.
 *
 * NOTE on architecture: CollexBase authenticates with a Bearer JWT kept in
 * `localStorage`, not in cookies. A Next.js edge `middleware.ts` cannot read
 * `localStorage`, so it cannot reliably know the caller's role at the edge.
 * Route protection is therefore enforced where the token is available:
 *
 *  - API routes under `/api/admin/*` call `requireAdmin` (this guard) directly.
 *  - The `/admin` page (and its sub-sections) gate on the client via
 *    `/api/admin/check`, redirecting non-admins away.
 *
 * This module exposes a small, reusable helper so any admin route handler can
 * enforce the policy with one call.
 */

export interface AdminGuardSuccess {
  ok: true
  admin: { userId: string; username: string; email: string }
}

export interface AdminGuardFailure {
  ok: false
  response: NextResponse
}

export type AdminGuardResult = AdminGuardSuccess | AdminGuardFailure

/**
 * Guards an admin-only request. On success returns the admin context; on
 * failure returns a ready-to-send JSON error response (401/403).
 *
 * Usage in a route handler:
 *   const guard = await adminGuard(req)
 *   if (!guard.ok) return guard.response
 *   // ...guard.admin is available here
 */
export async function adminGuard(req: Request): Promise<AdminGuardResult> {
  const res = await requireAdmin(req)
  if (!res.ok || !res.admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: res.error || "Accesso riservato agli amministratori." },
        { status: res.status || 403 },
      ),
    }
  }
  return { ok: true, admin: res.admin }
}
