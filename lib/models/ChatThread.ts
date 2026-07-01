import { Schema, model, models } from "mongoose"

/**
 * A conversation container for the Blocco 19 advanced messaging system.
 * Kept fully separate from the legacy `Conversation` model so prior blocks
 * are never touched. A thread is uniquely identified by (type + sorted
 * participants + contextId) so the same pair never gets duplicate threads.
 */
const ChatThreadSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["private", "trade", "marketplace", "auction"],
      required: true,
      index: true,
    },
    // Sorted array of userId strings.
    participants: { type: [String], required: true, index: true },
    // tradeId / listingId / auctionId, or null for private chats.
    contextId: { type: String, default: null, index: true },
    // Denormalized context label for quick display (e.g. item name).
    contextLabel: { type: String, default: "" },

    // Last message preview for thread lists.
    lastMessageText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null, index: true },
    lastSenderId: { type: String, default: "" },

    // Moderation (admin panel).
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    reportedBy: { type: [String], default: [] },
    reportReason: { type: String, default: "" },
  },
  { timestamps: true },
)

ChatThreadSchema.index({ type: 1, contextId: 1 })

const ChatThread = models.ChatThread || model("ChatThread", ChatThreadSchema)

export default ChatThread
