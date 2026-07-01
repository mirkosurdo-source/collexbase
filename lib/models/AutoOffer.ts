import { Schema, models, model } from "mongoose"

/**
 * Blocco 47 — Marketplace 2.0 automatic offers.
 *
 * A buyer sets a max price for a listing; when their offer is rejected the
 * system automatically re-offers a higher amount (incrementing toward maxPrice)
 * until the seller accepts or the cap is reached. Fully additive: it sits on top
 * of the existing Offer flow and never mutates a listing directly.
 */
const AutoOfferSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    listingName: { type: String, default: "", trim: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    maxPrice: { type: Number, required: true },
    // Last amount auto-offered, so the next bump is computed from here.
    lastOffer: { type: Number, default: 0 },
    // Increment per re-offer (EUR). Defaults derived from maxPrice.
    step: { type: Number, default: 1 },

    active: { type: Boolean, default: true, index: true },
    // Why it stopped: reached the cap, accepted, or cancelled by the user.
    closedReason: { type: String, enum: ["", "cap", "accepted", "cancelled"], default: "" },
    offersSent: { type: Number, default: 0 },
  },
  { timestamps: true },
)

// One active auto-offer per listing per user.
AutoOfferSchema.index({ userId: 1, listingId: 1 }, { unique: true })

const AutoOffer = models.AutoOffer || model("AutoOffer", AutoOfferSchema)

export default AutoOffer
