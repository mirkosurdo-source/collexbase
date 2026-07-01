import { Schema, models, model } from "mongoose"

/**
 * Blocco 47 — Marketplace 2.0 price history.
 *
 * One document per recorded sale/observation for a normalized card key. Purely
 * additive: nothing in the base marketplace depends on this collection, and it
 * is only appended to (never used to mutate listings/orders).
 */
const PriceHistorySchema = new Schema(
  {
    // Normalized item key (see cardKeyForName in lib/marketplace2.ts).
    cardId: { type: String, required: true, index: true },
    // Human-readable label kept for display.
    label: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    date: { type: Date, default: Date.now, index: true },
    price: { type: Number, required: true },
    source: {
      type: String,
      enum: ["marketplace", "seller_pro", "tcgplayer", "cardmarket", "ebay"],
      default: "marketplace",
    },
  },
  { timestamps: false },
)

PriceHistorySchema.index({ cardId: 1, date: 1 })

const PriceHistory = models.PriceHistory || model("PriceHistory", PriceHistorySchema)

export default PriceHistory
