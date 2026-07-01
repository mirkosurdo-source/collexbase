import { Schema, models, model } from "mongoose"

/** A single delivery attempt log entry (most recent kept, capped). */
const DeliverySchema = new Schema(
  {
    event: { type: String, default: "" },
    status: { type: Number, default: 0 }, // HTTP status, 0 = network error
    ok: { type: Boolean, default: false },
    error: { type: String, default: "" },
    attempts: { type: Number, default: 1 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

/**
 * A developer webhook subscription (Blocco 38). Events are signed with an
 * HMAC-SHA256 of the `secret`. After 10 consecutive failures the webhook is
 * automatically disabled.
 */
const WebhookSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    url: { type: String, required: true, trim: true },
    events: { type: [String], default: [] },
    secret: { type: String, required: true },

    active: { type: Boolean, default: true, index: true },

    deliveredCount: { type: Number, default: 0 },
    failureStreak: { type: Number, default: 0 },
    lastDeliveryAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    disabledReason: { type: String, default: "" },

    // Rolling log of the most recent delivery attempts (capped at 20).
    deliveries: { type: [DeliverySchema], default: [] },
  },
  { timestamps: true },
)

const Webhook = models.Webhook || model("Webhook", WebhookSchema)

export default Webhook
