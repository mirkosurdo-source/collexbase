import { withApiKey } from "@/lib/public-api"
import { getMarketOverview } from "@/lib/analytics"

// GET /api/public/analytics/market — overall market snapshot.
export async function GET(req: Request) {
  return withApiKey(req, "read:analytics", async () => {
    const overview = await getMarketOverview()
    return {
      activeTrades: overview.activeTrades,
      rising: overview.rising,
      falling: overview.falling,
      hotAuctions: overview.hotAuctions,
      mostSaved: overview.mostSaved,
    }
  })
}
