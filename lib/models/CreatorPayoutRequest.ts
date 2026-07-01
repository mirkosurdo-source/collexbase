import { Schema, models, model } from "mongoose"

/**
 * Blocco 51.1 — a creator's request to cash out part of their real-money
 * Creator Earnings. Funds are reserved (moved to pendingPayout) on request;
 * an admin then approves (→ totalPaidOut) or rejects (→ refunded to balance).
 */
const CreatorPayoutRequestSchema = new Schema(
  {
    creatorId: { type: String, required: true, index: true },
    /** Amount requested, in euros. */
    amount: { type: Number, required: true },
    /** Optional payout destination note (e.g. PayPal/IBAN), free text. */
    destination: { type: String, default: "", trim: true },
    status: {
      type: String,
      // Blocco 51.3: "paid" added — approval triggers a (Stripe Connect) transfer.
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending",
      index: true,
    },
    /** Admin note on the decision. */
    note: { type: String, default: "", trim: true },
    decidedAt: { type: Date, default: null },
    /** Blocco 51.3 — Stripe Connect transfer id once paid (null if manual). */
    stripeTransferId: { type: String, default: null },
    /** Admin user id who reviewed the request. */
    reviewedBy: { type: String, default: null },
    /** When the request was reviewed (alias of decidedAt, kept for clarity). */
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

const CreatorPayoutRequest =
  models.CreatorPayoutRequest || model("CreatorPayoutRequest", CreatorPayoutRequestSchema)

export default CreatorPayoutRequest
