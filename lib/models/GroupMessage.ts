import { Schema, model, models } from "mongoose"

/**
 * Blocco 30 — A message in a group's shared chat. A lightweight, group-scoped
 * chat kept separate from the private ChatThread engine (whose types are fixed
 * to private/trade/marketplace/auction). Polled by the group page.
 */
const GroupMessageSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    senderUsername: { type: String, default: "" },
    senderAvatar: { type: String, default: "" },
    text: { type: String, default: "", trim: true },
    image: { type: String, default: "" },
  },
  { timestamps: true },
)

GroupMessageSchema.index({ groupId: 1, createdAt: 1 })

const GroupMessage = models.GroupMessage || model("GroupMessage", GroupMessageSchema)

export default GroupMessage
