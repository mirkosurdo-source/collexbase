import { Schema, model, models } from "mongoose"

/**
 * Blocco 43 — Live Trades.
 *
 * Separate collection from the classic `Trade` model (fully additive). Two
 * users negotiate in real time via polling: each can add/remove items and
 * optional coins, chat, and both must confirm (double confirm). A countdown
 * auto-cancels the session when it expires.
 */

const TradeItemSchema = new Schema(
  {
    itemId: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    addedBy: { type: String, required: true },
  },
  { _id: true },
)

const LiveTradeChatSchema = new Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, default: "" },
    message: { type: String, required: true },
    system: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const LiveTradeSchema = new Schema(
  {
    userA: { type: String, required: true, index: true },
    userAUsername: { type: String, default: "" },
    userB: { type: String, required: true, index: true },
    userBUsername: { type: String, default: "" },

    itemsA: { type: [TradeItemSchema], default: [] },
    itemsB: { type: [TradeItemSchema], default: [] },
    coinsA: { type: Number, default: 0 },
    coinsB: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["pending", "live", "accepted", "declined", "cancelled"],
      default: "live",
      index: true,
    },

    // Double-confirm flags. Both must be true for an accepted trade.
    confirmedA: { type: Boolean, default: false },
    confirmedB: { type: Boolean, default: false },

    chat: { type: [LiveTradeChatSchema], default: [] },

    timerSeconds: { type: Number, default: 300 },
    expiresAt: { type: Date, required: true },

    // Set once both users confirm.
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

const LiveTrade = models.LiveTrade || model("LiveTrade", LiveTradeSchema)

export default LiveTrade
