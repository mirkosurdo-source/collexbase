import { Schema, models, model } from "mongoose"

/**
 * Blocco 51 — a single successful referral. One row per invited user
 * (enforced unique) so each person can only be referred once. Fully additive:
 * no existing model is touched.
 */
const ReferralEventSchema = new Schema(
  {
    inviterId: { type: String, required: true, index: true },
    invitedId: { type: String, required: true, unique: true, index: true },
    method: { type: String, enum: ["link", "qr", "whatsapp"], default: "link" },
    /** Whether the +20/+20 CollexCoins reward has been paid out. */
    coinsRewarded: { type: Boolean, default: false },
    /** Optional creator referral code that captured this signup. */
    creatorCode: { type: String, default: null, index: true },
    /** Coarse anti-abuse signals captured at claim time. */
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

const ReferralEvent = models.ReferralEvent || model("ReferralEvent", ReferralEventSchema)

export default ReferralEvent
