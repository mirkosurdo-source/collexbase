import { Schema, models, model } from "mongoose"

/**
 * Blocco 47 — Marketplace 2.0 price alerts.
 *
 * A user watches a normalized card key and is notified when the latest recorded
 * price crosses a target (above/below/reaches) or swings hard in 24h.
 */
const PriceAlertSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cardId: { type: String, required: true, index: true },
    label: { type: String, default: "", trim: true },
    targetPrice: { type: Number, default: 0 },
    // above: fires when price rises above target; below: when it drops under target;
    // reaches: when it hits the target (within a small tolerance); swing: >10% in 24h.
    direction: { type: String, enum: ["above", "below", "reaches", "swing"], default: "below" },
    active: { type: Boolean, default: true, index: true },
    lastTriggeredAt: { type: Date, default: null },
    lastTriggeredPrice: { type: Number, default: 0 },
    triggerCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

const PriceAlert = models.PriceAlert || model("PriceAlert", PriceAlertSchema)

export default PriceAlert
