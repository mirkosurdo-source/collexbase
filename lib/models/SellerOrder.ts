import { Schema, models, model } from "mongoose"

/** A line item captured at purchase time (denormalized for history). */
const OrderLineSchema = new Schema(
  {
    inventoryItemId: { type: Schema.Types.ObjectId, ref: "SellerInventoryItem", default: null },
    title: { type: String, default: "", trim: true },
    image: { type: String, default: "", trim: true },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 1 },
  },
  { _id: false },
)

/**
 * Blocco 41 — a Pro-seller order, parallel to the base escrow flow.
 *
 * Commission and payout are computed at creation. When Stripe Connect is
 * configured the payout is settled via a transfer to the seller's connected
 * account; otherwise it is recorded for manual settlement (graceful degrade).
 */
const SellerOrderSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    items: { type: [OrderLineSchema], default: [] },

    total: { type: Number, required: true, min: 0 },
    commissionRate: { type: Number, default: 0.05 },
    commission: { type: Number, default: 0 },
    payoutAmount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "completed", "cancelled"],
      default: "pending",
      index: true,
    },

    // Shipping.
    trackingCarrier: { type: String, default: "", trim: true },
    trackingNumber: { type: String, default: "", trim: true },
    shippedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    // Stripe references.
    stripePaymentIntentId: { type: String, default: "" },
    stripeTransferId: { type: String, default: null },
    payoutSettled: { type: Boolean, default: false },

    // Buyer review linkage (one review per order).
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true },
)

// Blocco 50 — seller/buyer order lists filter by party (+ optional status) and sort by recency.
SellerOrderSchema.index({ sellerId: 1, status: 1, createdAt: -1 })
SellerOrderSchema.index({ buyerId: 1, status: 1, createdAt: -1 })

const SellerOrder = models.SellerOrder || model("SellerOrder", SellerOrderSchema)

export default SellerOrder
