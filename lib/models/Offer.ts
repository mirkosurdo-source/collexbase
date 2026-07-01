import { Schema, models, model } from "mongoose"

const OfferedItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "CollectionItem" },
    name: { type: String, default: "", trim: true },
    image: { type: String, default: "", trim: true },
    value: { type: Number, default: 0 },
  },
  { _id: false },
)

const OfferSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    listingName: { type: String, default: "", trim: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerUsername: { type: String, default: "", trim: true },

    type: {
      type: String,
      enum: ["buy", "offer", "counteroffer", "trade", "item_cash", "item_coins"],
      required: true,
    },
    // Cash component (EUR) and coins component for hybrid offers.
    amount: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    offeredItems: { type: [OfferedItemSchema], default: [] },

    // Total estimated value of the offer (for AI fairness).
    offerValue: { type: Number, default: 0 },
    fairnessScore: { type: Number, default: 0 },
    fairnessVerdict: { type: String, default: "" },

    message: { type: String, default: "", trim: true },
    status: { type: String, enum: ["pending", "accepted", "rejected", "countered"], default: "pending", index: true },
    // The direction of a counteroffer: who made this offer.
    fromSeller: { type: Boolean, default: false },
    parentOfferId: { type: Schema.Types.ObjectId, ref: "Offer", default: null },
  },
  { timestamps: true },
)

// Blocco 50 — incoming/outgoing offer lists filter by party + status.
OfferSchema.index({ sellerId: 1, status: 1, createdAt: -1 })
OfferSchema.index({ buyerId: 1, status: 1, createdAt: -1 })

const Offer = models.Offer || model("Offer", OfferSchema)

export default Offer
