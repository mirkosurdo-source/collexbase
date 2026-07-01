import { Schema, models, model } from "mongoose"

/**
 * Real-money (EUR) wallet for the Stripe-backed payments system (Blocco 16).
 * Intentionally separate from the existing Collex `Wallet` model so prior
 * blocks (subscriptions, Collex Coin, rewards) keep working unchanged.
 *
 * Buckets:
 *  - available: withdrawable / spendable balance
 *  - pending:   funds held in escrow awaiting delivery
 *  - blocked:   funds frozen due to an open dispute
 */
const PaymentWalletSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    available: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    blocked: { type: Number, default: 0 },
    currency: { type: String, default: "eur" },
  },
  { timestamps: true },
)

const PaymentWallet = models.PaymentWallet || model("PaymentWallet", PaymentWalletSchema)

export default PaymentWallet
