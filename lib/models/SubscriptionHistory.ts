import { Schema, models, model } from "mongoose"

const SubscriptionHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    event: {
      type: String,
      enum: ["signup", "upgrade", "downgrade", "renew", "cancel"],
      required: true,
    },
    fromPlan: { type: String, enum: ["Base", "Gold", "Premium"], default: "Base" },
    toPlan: { type: String, enum: ["Base", "Gold", "Premium"], required: true },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    amount: { type: Number, default: 0 },
    note: { type: String, default: "", trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

const SubscriptionHistory = models.SubscriptionHistory || model("SubscriptionHistory", SubscriptionHistorySchema)

export default SubscriptionHistory
