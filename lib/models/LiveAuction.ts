import { Schema, model, models } from "mongoose"

/**
 * Blocco 43 — Live Auctions.
 *
 * Fully additive: this is a separate collection from the classic `Auction`
 * model and never mutates it. Real-time behaviour (live bids, chat, countdown)
 * is delivered via fast client polling of the status endpoint, since the
 * serverless runtime has no persistent WebSocket support.
 */

const LiveBidSchema = new Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, default: "" },
    amount: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const LiveChatMessageSchema = new Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, default: "" },
    message: { type: String, required: true },
    system: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const LiveAuctionSchema = new Schema(
  {
    sellerId: { type: String, required: true, index: true },
    sellerUsername: { type: String, default: "" },

    itemId: { type: String, default: "" },
    itemName: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    image: { type: String, default: "", trim: true },

    startPrice: { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    minIncrement: { type: Number, required: true, default: 1 },
    highestBidderId: { type: String, default: null },
    highestBidderUsername: { type: String, default: "" },

    status: {
      type: String,
      enum: ["scheduled", "live", "ended", "cancelled"],
      default: "live",
      index: true,
    },

    startAt: { type: Date, default: Date.now },
    endAt: { type: Date, required: true },

    // Anti-sniping: when a bid lands in the final window, extend the deadline.
    autoExtend: { type: Boolean, default: true },
    autoExtendSeconds: { type: Number, default: 10 },
    extendWindowSeconds: { type: Number, default: 5 },
    extensionsCount: { type: Number, default: 0 },

    bids: { type: [LiveBidSchema], default: [] },
    chat: { type: [LiveChatMessageSchema], default: [] },

    // Set when the auction ends with a winner (marketplace order reference).
    orderId: { type: String, default: null },

    // Blocco 51 — automatic non-payment fine (CollexCoin, opzione B / internal debt).
    // All additive: never set/read by the classic auction engine.
    finalPrice: { type: Number, default: null }, // final price in € at win time
    winnerId: { type: String, default: null }, // userId of the winner
    paymentDeadline: { type: Date, default: null }, // win + 48h
    paymentStatus: {
      type: String,
      enum: ["none", "pending", "paid", "expired"],
      default: "none",
      index: true,
    },
    finePercentage: { type: Number, default: 20 }, // fine as % of final price
    fineApplied: { type: Boolean, default: false }, // true once fine debited
    fineAmountCollex: { type: Number, default: 0 }, // fine amount in CollexCoin
    // Reminder bookkeeping so each reminder fires at most once.
    reminder24Sent: { type: Boolean, default: false },
    reminder46Sent: { type: Boolean, default: false },
  },
  { timestamps: true },
)

// Blocco 50 — reminder/fine cron sweeps query pending payments by deadline.
LiveAuctionSchema.index({ paymentStatus: 1, paymentDeadline: 1 })

const LiveAuction = models.LiveAuction || model("LiveAuction", LiveAuctionSchema)

export default LiveAuction
