import { withApiKey } from "@/lib/public-api"
import { getMarketOverview, getShowcaseTrendOverview } from "@/lib/analytics"

// GET /api/public/analytics/trending — rising categories, hot auctions, trending showcases.
export async function GET(req: Request) {
  return withApiKey(req, "read:analytics", async () => {
    const [market, showcases] = await Promise.all([getMarketOverview(), getShowcaseTrendOverview()])
    return {
      risingCategories: market.rising,
      hotAuctions: market.hotAuctions,
      mostSaved: market.mostSaved,
      trendingShowcases: showcases,
    }
  })
}
