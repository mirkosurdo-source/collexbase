import { Schema, models, model } from "mongoose"

/**
 * Blocco 41 — Marketplace Pro.
 *
 * A professional-seller profile. Fully additive: regular users and the base
 * marketplace are untouched. A profile only exists once an admin activates the
 * seller, which unlocks the Pro inventory, dashboard and Stripe Connect payouts.
 */
const SellerProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    username: { type: String, default: "", trim: true },

    active: { type: Boolean, default: true, index: true },

    // Stripe Connect (Express) account for automatic payouts.
    stripeAccountId: { type: String, default: null },
    // Cached onboarding state from Stripe: charges/payouts enabled + details submitted.
    stripeChargesEnabled: { type: Boolean, default: false },
    stripePayoutsEnabled: { type: Boolean, default: false },
    stripeDetailsSubmitted: { type: Boolean, default: false },

    // Marketplace commission rate as a fraction (0.05 = 5%).
    commissionRate: { type: Number, default: 0.05, min: 0, max: 0.5 },

    // Lifetime aggregates (kept in sync as orders complete).
    totalSales: { type: Number, default: 0 }, // gross revenue
    totalOrders: { type: Number, default: 0 }, // completed orders
    totalCommission: { type: Number, default: 0 },
    totalPayout: { type: Number, default: 0 },

    // Rating: running average + count of seller reviews.
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    // Timestamp since which the rating has stayed >= 4.8 (for Trusted Seller badge).
    highRatingSince: { type: Date, default: null },

    activatedAt: { type: Date, default: Date.now },
    deactivatedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

const SellerProfile = models.SellerProfile || model("SellerProfile", SellerProfileSchema)

export default SellerProfile
