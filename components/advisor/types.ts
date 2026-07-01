import type { SparkPose } from "@/components/collexspark/CollexSpark"

export type Severity = "positive" | "warning" | "deal" | "info"

export interface Insight {
  id: string
  pose: SparkPose
  severity: Severity
  title: string
  message: string
  link?: string
  value?: number
}

export interface TrendPoint {
  label: string
  value: number
}

export interface CollectionReport {
  success: boolean
  cards: Insight[]
  buckets: {
    rising: string[]
    falling: string[]
    toSell: string[]
    toHold: string[]
    toAuction: string[]
    duplicates: string[]
    rare: string[]
    highDemand: string[]
    atRisk: string[]
  }
  categoryTrends: TrendPoint[]
  totals: { items: number; totalValue: number; forecastValue: number }
}

export interface MarketplaceReport {
  success: boolean
  cards: Insight[]
  underpriced: Array<{ id: string; name: string; price: number; fair: number; image: string }>
  overpriced: Array<{ id: string; name: string; price: number; fair: number; image: string }>
  trustedSellers: string[]
}

export interface TradeReport {
  success: boolean
  cards: Insight[]
  evaluations: Array<{
    id: string
    role: "incoming" | "outgoing"
    offeredItemName: string
    requestedItemName: string
    offeredValue: number
    requestedValue: number
    verdict: string
    score: number
  }>
}

export interface AuctionReport {
  success: boolean
  cards: Insight[]
  undervalued: Array<{ id: string; name: string; currentPrice: number; bids: number; image: string }>
}

export interface WishlistReport {
  success: boolean
  cards: Insight[]
  matches: Array<{ listingId: string; name: string; price: number; targetPrice: number; image: string; belowTarget: boolean }>
}
