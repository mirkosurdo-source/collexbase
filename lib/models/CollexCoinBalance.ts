import { Schema, models, model } from "mongoose"

/**
 * Standalone Collex Coin balance ledger (Blocco 15.1).
 *
 * This is intentionally separate from the Wallet model: the Wallet holds the
 * legacy `coins` field used by older blocks, while this ledger is the canonical
 * source of truth for the Collex Coin internal currency introduced here.
 *
 * `claimedSignupPlans` tracks which subscription tiers' welcome bonuses have
 * already been granted, so changing/activating a tier grants its bonus at most
 * once (idempotent, exploit-safe).
 */
const CollexCoinBalanceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    // Blocco 51 (opzione B): the balance may go negative (internal debt) when an
    // auction non-payment fine is debited from a winner with insufficient coins.
    balance: { type: Number, default: 0 },
    lastDailyAt: { type: Date, default: null },
    claimedSignupPlans: { type: [String], default: [] },
  },
  { timestamps: true },
)

const CollexCoinBalance = models.CollexCoinBalance || model("CollexCoinBalance", CollexCoinBalanceSchema)

export default CollexCoinBalance
