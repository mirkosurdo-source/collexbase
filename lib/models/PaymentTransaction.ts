import { Schema, models, model } from "mongoose"

export const PAYMENT_TX_KINDS = [
  "deposit",
  "withdraw",
  "transfer_in",
  "transfer_out",
  "escrow_hold",
  "escrow_release",
  "escrow_refund",
  "buyer_fee",
  "seller_fee",
  "trade_fee",
  "subscription",
  "dispute_hold",
  "dispute_resolved",
] as const

export type PaymentTxKind = (typeof PAYMENT_TX_KINDS)[number]

export const PAYMENT_TX_STATUSES = ["pending", "completed", "failed", "refunded"] as const
export type PaymentTxStatus = (typeof PAYMENT_TX_STATUSES)[number]

/**
 * Append-only ledger for real-money (EUR) movements. `amount` is signed:
 * positive = credit to the user, negative = debit.
 */
const PaymentTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: PAYMENT_TX_KINDS, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "eur" },
    status: { type: String, enum: PAYMENT_TX_STATUSES, default: "completed" },
    description: { type: String, default: "", trim: true },

    counterpartyId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    escrowId: { type: Schema.Types.ObjectId, ref: "PaymentEscrow", default: null },

    stripePaymentIntentId: { type: String, default: "" },
    stripeChargeId: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
)

PaymentTransactionSchema.index({ userId: 1, createdAt: -1 })

const PaymentTransaction =
  models.PaymentTransaction || model("PaymentTransaction", PaymentTransactionSchema)

export default PaymentTransaction
