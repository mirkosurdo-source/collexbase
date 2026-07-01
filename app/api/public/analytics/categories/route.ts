import { withApiKey } from "@/lib/public-api"
import { getMarketOverview } from "@/lib/analytics"

// GET /api/public/analytics/categories — per-category market trend data.
export async function GET(req: Request) {
  return withApiKey(req, "read:analytics", async () => {
    const overview = await getMarketOverview()
    return { categories: overview.categories }
  })
}
