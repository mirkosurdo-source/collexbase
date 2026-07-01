import { Schema, models, model } from "mongoose"

/**
 * Tracks the user's live subscription state: current plan plus the per-period
 * counters used to enforce AI limits and grant subscription coin bonuses.
 */
const UserSubscriptionStateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    plan: { type: String, enum: ["Base", "Gold", "Premium"], default: "Base" },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    // AI valuation usage tracking (daily window).
    aiCreditsUsedToday: { type: Number, default: 0 },
    aiResetAt: { type: Date, default: null },
    // Subscription coin grants.
    lastDailyCoinAt: { type: Date, default: null },
    lastMonthlyCoinAt: { type: Date, default: null },
    // One-time signup bonus per plan tier.
    signupBonusClaimed: { type: Boolean, default: false },
    signupBonusPlan: { type: String, enum: ["Base", "Gold", "Premium"], default: null },
  },
  { timestamps: true },
)

const UserSubscriptionState =
  models.UserSubscriptionState || model("UserSubscriptionState", UserSubscriptionStateSchema)

export default UserSubscriptionState
