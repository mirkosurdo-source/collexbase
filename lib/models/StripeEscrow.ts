import { Schema, models, model } from "mongoose"

/**
 * BLOCCO FINALE — real-money escrow for Stripe Connect payouts.
 *
 * IMPORTANT: this is intentionally distinct from the internal-wallet `Escrow`
 * model (which moves CollexCoin/internal "money" between wallets). This model
 * never stores a spendable balance — it only tracks REAL funds that live in
 * Stripe until they are transferred to the seller's connected account.
 *
 * Amounts are stored in CENTS (integer) to match Stripe's API.
 */
const StripeEscrowSchema = new Schema(
  {
    // Reference to the marketplace/seller order this payment belongs to.
    orderId: { type: String, required: true, unique: true, index: true },

    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Snapshot of the seller's Stripe Connect account at escrow creation time.
    sellerStripeId: { type: String, required: true },

    amount: { type: Number, required: true }, // gross amount in cents
    commission: { type: Number, default: 0 }, // platform commission in cents

    released: { type: Boolean, default: false, index: true },
    // createdAt + 48h: when the cron auto-releases funds if the buyer is silent.
    autoReleaseAt: { type: Date, required: true },
    releasedAt: { type: Date, default: null },
    // Stripe Transfer id once the payout has been executed (idempotency aid).
    transferId: { type: String, default: null },
  },
  { timestamps: true },
)

// Cron sweep: find unreleased escrows whose 48h window has elapsed.
StripeEscrowSchema.index({ released: 1, autoReleaseAt: 1 })

const StripeEscrow = models.StripeEscrow || model("StripeEscrow", StripeEscrowSchema)

export default StripeEscrow
