import { Schema, models, model } from "mongoose"

export const ESCROW_STATUSES = ["awaiting_payment", "held", "released", "disputed", "refunded"] as const
export type EscrowStatus = (typeof ESCROW_STATUSES)[number]

/**
 * Stripe-backed marketplace escrow record. Money flow:
 *  awaiting_payment -> held (buyer paid, funds in seller.pending)
 *  held -> released (delivered: pending -> available minus seller fee)
 *  held -> disputed (funds frozen: pending -> blocked)
 *  disputed/held -> refunded (Stripe refund to buyer)
 */
const PaymentEscrowSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", default: null, index: true },
    itemName: { type: String, default: "", trim: true },

    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    buyerTier: { type: String, enum: ["Base", "Gold", "Premium"], default: "Base" },
    sellerTier: { type: String, enum: ["Base", "Gold", "Premium"], default: "Base" },

    amount: { type: Number, required: true }, // item price (EUR)
    buyerFee: { type: Number, default: 0 },
    sellerFee: { type: Number, default: 0 },
    buyerTotal: { type: Number, default: 0 }, // charged to buyer
    sellerNet: { type: Number, default: 0 }, // credited to seller on release

    status: { type: String, enum: ESCROW_STATUSES, default: "awaiting_payment", index: true },
    disputeReason: { type: String, default: "" },

    stripePaymentIntentId: { type: String, default: "", index: true },

    heldAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

const PaymentEscrow = models.PaymentEscrow || model("PaymentEscrow", PaymentEscrowSchema)

export default PaymentEscrow
