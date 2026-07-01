import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getPlatformAnalytics } from "@/lib/analytics"

export const dynamic = "force-dynamic"

/** Admin: aggregated, anonymized platform-wide analytics (Blocco 34). */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

  try {
    const data = await getPlatformAnalytics()
    return NextResponse.json({ success: true, ...data })
  } catch (err) {
    console.error("[admin/analytics] error:", err)
    return NextResponse.json({ success: false, message: "Errore nel calcolo degli analytics" }, { status: 500 })
  }
}
