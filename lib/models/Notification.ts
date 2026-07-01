import { Schema, model, models } from "mongoose"

// Blocco 20: context lets a notification deep-link to the originating entity.
const NotificationContextSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["chat", "trade", "listing", "auction", "payment", "dispute"],
      required: true,
    },
    id: { type: String, required: true },
  },
  { _id: false },
)

const NotificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      // Original Blocco values kept for backward compatibility, plus the
      // unified Blocco 20 event types.
      enum: [
        "auction",
        "trade",
        "message",
        "system",
        "chat",
        "marketplace",
        "payment",
        "escrow",
        "moderation",
      ],
      default: "system",
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    // Blocco 20: structured context for client-side deep-linking.
    context: { type: NotificationContextSchema, default: null },
    read: { type: Boolean, default: false },
    // Blocco 20: soft-delete so audit/admin can still see volume.
    deleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
)

// Speeds up the "?since=" incremental polling queries.
NotificationSchema.index({ userId: 1, createdAt: -1 })

const Notification = models.Notification || model("Notification", NotificationSchema)

export default Notification
