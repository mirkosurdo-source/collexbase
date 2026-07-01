import mongoose, { Schema, model, models } from "mongoose"

/**
 * Blocco 34 — cached per-category market trend aggregates.
 *
 * Refreshed on demand from existing Listing / Auction / Trade data. Purely
 * additive: it never mutates marketplace, auction or trade documents.
 */
const MarketTrendSchema = new Schema(
  {
    category: { type: String, required: true, unique: true, index: true },
    avgValue: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
    trend7d: { type: Number, default: 0 },
    trend30d: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

const MarketTrend = models.MarketTrend || model("MarketTrend", MarketTrendSchema)

export default MarketTrend
