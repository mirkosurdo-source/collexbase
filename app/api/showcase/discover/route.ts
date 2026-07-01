import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth/request"
import {
  getShowcaseDiscovery,
  getRecommendedShowcases,
  getGroupShowcases,
  getFeaturedShowcases,
  SHOWCASE_THEMES,
} from "@/lib/showcase"

/** GET /api/showcase/discover — popular, new, by-theme, and recommended feeds. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const theme = searchParams.get("theme") || ""
    const userId = getAuthUserId(req)

    const [discovery, recommended, groupShowcases, featured] = await Promise.all([
      getShowcaseDiscovery(theme || undefined),
      userId ? getRecommendedShowcases(userId, 6) : Promise.resolve([]),
      userId ? getGroupShowcases(userId, 12) : Promise.resolve([]),
      getFeaturedShowcases(8),
    ])

    return NextResponse.json({
      success: true,
      themes: SHOWCASE_THEMES,
      ...discovery,
      recommended,
      groupShowcases,
      featured,
    })
  } catch (error) {
    console.error("[v0] GET /api/showcase/discover error:", error)
    return NextResponse.json({ success: false, error: "Errore del server" }, { status: 500 })
  }
}
