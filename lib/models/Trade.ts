import { Schema, model, models } from "mongoose"

const MessageSchema = new Schema(
  {
    senderId: { type: String, required: true },
    senderUsername: { type: String, default: "" },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const TradeSchema = new Schema(
  {
    // Proposer (sender of the trade request).
    fromUserId: { type: String, required: true },
    fromUsername: { type: String, default: "" },
    // Recipient (owner of the requested item).
    toUserId: { type: String, required: true },
    toUsername: { type: String, default: "" },

    // Offered item (belongs to fromUser).
    offeredItemId: { type: String, required: true },
    offeredItemName: { type: String, default: "" },
    offeredItemImage: { type: String, default: "" },

    // Requested item (belongs to toUser).
    requestedItemId: { type: String, required: true },
    requestedItemName: { type: String, default: "" },
    requestedItemImage: { type: String, default: "" },

    message: { type: String, default: "" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },

    messages: { type: [MessageSchema], default: [] },
  },
  { timestamps: true },
)

export default models.Trade || model("Trade", TradeSchema)
