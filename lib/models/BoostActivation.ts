import { Schema, models, model } from "mongoose"

export const BOOST_TARGET_TYPES = ["marketplace", "auction", "trade", "showcase"] as const
export const BOOST_TIERS = ["base", "plus", "ultra"] as const

export type BoostTargetType = (typeof BOOST_TARGET_TYPES)[number]
export type BoostTier = (typeof BOOST_TIERS)[number]

/**
 * Blocco 33 — Boost Marketplace.
 *
 * Append-only record of a premium visibility boost purchased with CollexCoins.
 * Fully additive: references existing marketplace/auction/trade/showcase targets
 * by id without modifying any of those engines.
 */
const BoostActivationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetType: { type: String, enum: BOOST_TARGET_TYPES, required: true, index: true },
    // Stored as string so it works for both ObjectId-keyed (Listing/Showcase)
    // and string-keyed (Auction/Trade) engines without coupling to them.
    targetId: { type: String, required: true, index: true },
    tier: { type: String, enum: BOOST_TIERS, required: true },
    coinsSpent: { type: Number, required: true },
    // Visibility multiplier and ranking weight derived from the tier.
    visibilityPct: { type: Number, default: 0 },
    // Admin can disable an abusive boost without deleting the audit record.
    disabled: { type: Boolean, default: false },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
)

// Fast lookup of the active boost for a given target.
BoostActivationSchema.index({ targetType: 1, targetId: 1, endsAt: -1 })

const BoostActivation = models.BoostActivation || model("BoostActivation", BoostActivationSchema)

export default BoostActivation
