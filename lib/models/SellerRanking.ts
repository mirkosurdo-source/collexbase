import { Schema, models, model } from "mongoose"

/**
 * Blocco 47 — Marketplace 2.0 cached seller ranking.
 *
 * Recomputed from reviews, reputation, seller-profile aggregates and recent
 * sales. Purely a cache for fast display in listings/profiles; recomputed on
 * demand and never used to mutate seller documents.
 */
const SellerRankingSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    score: { type: Number, default: 0, index: true },
    tier: { type: String, default: "" }, // Top / Power / Trusted / Elite Seller (or "")
    ordersCompleted: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    disputes: { type: Number, default: 0 },
    last30DaysSales: { type: Number, default: 0 },
    commissionPaid: { type: Number, default: 0 },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

const SellerRanking = models.SellerRanking || model("SellerRanking", SellerRankingSchema)

export default SellerRanking
