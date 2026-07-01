import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"

/** Lightweight gate used by the admin UI to verify access. */
export async function GET(req: Request) {
  const res = await requireAdmin(req)
  if (!res.ok) return NextResponse.json({ admin: false, message: res.error }, { status: res.status })
  return NextResponse.json({ admin: true, operator: res.admin })
}
