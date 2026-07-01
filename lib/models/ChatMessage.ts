import { Schema, model, models } from "mongoose"

const AttachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    name: { type: String, default: "" },
    contentType: { type: String, default: "" },
    size: { type: Number, default: 0 },
  },
  { _id: false },
)

/**
 * A single message inside a ChatThread (Blocco 19). Separate from the legacy
 * message system. Soft-deletion via `deleted` keeps moderation auditable.
 */
const ChatMessageSchema = new Schema(
  {
    threadId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    senderUsername: { type: String, default: "" },
    text: { type: String, default: null },
    attachments: { type: [AttachmentSchema], default: [] },
    // userId[] who have read this message.
    readBy: { type: [String], default: [] },
    // Moderation soft-delete.
    deleted: { type: Boolean, default: false },
    deletedBy: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

ChatMessageSchema.index({ threadId: 1, createdAt: 1 })

const ChatMessage = models.ChatMessage || model("ChatMessage", ChatMessageSchema)

export default ChatMessage
