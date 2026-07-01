import { Schema, model, models } from "mongoose"

/** A directional block: `blockerId` no longer receives messages from `blockedId`. */
const ChatBlockSchema = new Schema(
  {
    blockerId: { type: String, required: true, index: true },
    blockedId: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

ChatBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true })

const ChatBlock = models.ChatBlock || model("ChatBlock", ChatBlockSchema)

export default ChatBlock
