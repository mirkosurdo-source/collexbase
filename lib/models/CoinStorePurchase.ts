import mongoose, { Schema } from "mongoose"

export interface ICoinStorePurchase {
  userId: string
  packageId: string
  coins: number
  realValue: number
  storePrice: number
  tier: "Base" | "Gold" | "Premium"
  tierDiscountPct: number
  finalPrice: number
  savings: number
  totalDiscountPct: number
  stripeSessionId: string | null
  status: "pending" | "completed" | "failed"
  creditedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Blocco 23 — record of a CollexCoins store purchase.
 *
 * Used both for idempotent crediting (stripeSessionId is unique) and for the
 * admin store analytics. Kept separate from the wallet ledger so existing coin
 * flows are untouched.
 */
const CoinStorePurchaseSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    packageId: { type: String, required: true },
    coins: { type: Number, required: true },
    // Pricing snapshot at purchase time.
    realValue: { type: Number, required: true },
    storePrice: { type: Number, required: true },
    tier: { type: String, enum: ["Base", "Gold", "Premium"], default: "Base" },
    tierDiscountPct: { type: Number, default: 0 },
    finalPrice: { type: Number, required: true },
    savings: { type: Number, default: 0 },
    totalDiscountPct: { type: Number, default: 0 },
    // Stripe session id; sparse + unique guarantees idempotent crediting.
    stripeSessionId: { type: String, default: null, unique: true, sparse: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending", index: true },
    creditedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

CoinStorePurchaseSchema.index({ createdAt: -1 })
CoinStorePurchaseSchema.index({ status: 1, createdAt: -1 })

export default (mongoose.models.CoinStorePurchase as mongoose.Model<ICoinStorePurchase>) ||
  mongoose.model<ICoinStorePurchase>("CoinStorePurchase", CoinStorePurchaseSchema)
