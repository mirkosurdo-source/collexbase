import { Schema, model, models } from "mongoose"

/**
 * An item reference used inside trade/multi-trade offers. Denormalized so the
 * chat can render the offered/requested goods without extra lookups.
 */
const OfferItemSchema = new Schema(
  {
    id: { type: String, default: "" },
    name: { type: String, default: "" },
    image: { type: String, default: "" },
    value: { type: Number, default: 0 },
  },
  { _id: false },
)

/**
 * An embedded offer attached to a message. Supports cash, item+cash,
 * item+CollexCoins, and multi-item trades. AI advisor fields are computed at
 * creation time so both parties see the same fairness analysis.
 */
const OfferSchema = new Schema(
  {
    offerType: {
      type: String,
      enum: ["cash", "item_cash", "item_coins", "multi_trade"],
      required: true,
    },
    proposerId: { type: String, required: true },
    amount: { type: Number, default: 0 }, // cash in EUR
    coins: { type: Number, default: 0 }, // CollexCoins
    offeredItems: { type: [OfferItemSchema], default: [] },
    requestedItems: { type: [OfferItemSchema], default: [] },
    listingId: { type: String, default: "" },
    listingName: { type: String, default: "" },
    askValue: { type: Number, default: 0 },
    offerValue: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "withdrawn", "countered"],
      default: "pending",
    },
    // AI advisor snapshot
    aiScore: { type: Number, default: 0 },
    aiVerdict: { type: String, default: "" },
    aiMessage: { type: String, default: "" },
    aiSuggestedCounter: { type: Number, default: 0 },
    aiDemand: { type: Number, default: 1 },
  },
  { _id: false },
)

/**
 * A message within a conversation. `type` distinguishes plain text, images,
 * file attachments, and offer/negotiation messages.
 */
const MessageSchema = new Schema(
  {
    senderId: { type: String, required: true },
    senderUsername: { type: String, default: "" },
    type: {
      type: String,
      enum: ["text", "image", "attachment", "offer"],
      default: "text",
    },
    text: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    attachment: {
      type: {
        url: { type: String, default: "" },
        name: { type: String, default: "" },
        size: { type: Number, default: 0 },
        contentType: { type: String, default: "" },
      },
      default: undefined,
    },
    offer: { type: OfferSchema, default: undefined },
    readBy: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

/**
 * A 1:1 conversation between two users. `participants` always holds exactly
 * two user ids. We denormalize the participant usernames/avatars so the
 * conversation list can render without extra lookups, and keep a snapshot of
 * the last message plus per-user unread counts for fast list rendering.
 */
const ConversationSchema = new Schema(
  {
    participants: { type: [String], required: true, index: true },
    participantInfo: {
      type: [
        {
          userId: { type: String, required: true },
          username: { type: String, default: "" },
          avatar: { type: String, default: "" },
        },
      ],
      default: [],
    },
    messages: { type: [MessageSchema], default: [] },
    lastMessage: { type: String, default: "" },
    lastSenderId: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    // Map of userId -> number of unread messages for that user.
    unread: { type: Map, of: Number, default: {} },
    // Map of userId -> epoch ms of their last "typing" ping.
    typing: { type: Map, of: Number, default: {} },
    // True while there is at least one pending offer in the thread.
    activeNegotiation: { type: Boolean, default: false },
  },
  { timestamps: true },
)

const Conversation = models.Conversation || model("Conversation", ConversationSchema)

export default Conversation
