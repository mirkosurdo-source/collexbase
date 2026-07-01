/** Shared response shapes from the CollexBase backend (subset used by mobile). */

export interface SparkComment {
  pose: "happy" | "alert" | "deal" | "auction" | "trend"
  message: string
}

export interface Identification {
  name: string
  category?: string | null
  series: string | null
  set: string | null
  rarity: string | null
}

export interface ValueEstimate {
  estimated: number
  min: number
  max: number
  trend: "up" | "stable" | "down"
  trendPercent: number
}

export interface Grading {
  condition: string
  grade?: string
  notes?: string
}

export interface Advisor {
  sellNow: boolean
  hold: boolean
  auctionRecommended: boolean
  tradeRecommended: boolean
  reason: string
}

export interface SingleScanResult {
  success: boolean
  mode: "single"
  identification: Identification
  grading: Grading
  value: ValueEstimate
  advisor: Advisor
  spark: SparkComment
  isRare: boolean
}

export interface DetectedCard {
  id: string
  name: string
  series: string | null
  set: string | null
  rarity: string | null
  condition: string
  estimatedValue: number
  minValue: number
  maxValue: number
  trend: "up" | "stable" | "down"
  trendPercent: number
  position: string
  isRare: boolean
}

export interface MultiScanResult {
  success: boolean
  mode: "multi"
  cards: DetectedCard[]
  totalValue: number
  totalMin: number
  totalMax: number
  count: number
  duplicates: { name: string; count: number }[]
  spark: SparkComment
}

export interface MarketListing {
  _id: string
  itemName?: string
  name?: string
  title?: string
  price: number
  category?: string
  image?: string
  imageUrl?: string
  status?: string
  sellerUsername?: string
}

export interface AuctionItem {
  _id: string
  itemName?: string
  title?: string
  currentBid?: number
  startingPrice?: number
  image?: string
  endsAt?: string
  status?: string
}

export interface Auction {
  _id: string
  itemName: string
  imageUrl?: string
  currentBid?: number
  startingPrice: number
  bidCount?: number
  endsAt: string
  status?: string
}

export interface TradeItemRef {
  name: string
}

export interface Trade {
  _id: string
  status: string
  counterpartyName?: string
  offeredItems?: TradeItemRef[]
  requestedItems?: TradeItemRef[]
}

export interface Group {
  _id: string
  name: string
  description?: string
  imageUrl?: string
  memberCount?: number
}

export interface Showcase {
  _id: string
  title: string
  username?: string
  theme?: string
  coverImageUrl?: string
  followerCount?: number
}

export interface Opportunity {
  id: string
  type: string
  title: string
  message: string
  potentialValue?: number
}

export interface ChatThread {
  _id: string
  otherName?: string
  otherAvatarUrl?: string
  lastMessage?: string
  lastMessageAt?: string
  unreadCount?: number
}
