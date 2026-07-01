import { Schema, models, model } from "mongoose"

const SubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    plan: { type: String, enum: ["Base", "Gold", "Premium"], default: "Base" },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    status: { type: String, enum: ["active", "canceled", "expired"], default: "active" },
    price: { type: Number, default: 0 },
    autoRenew: { type: Boolean, default: true },
    startedAt: { type: Date, default: Date.now },
    currentPeriodEnd: { type: Date, default: null },
  },
  { timestamps: true },
)

const Subscription = models.Subscription || model("Subscription", SubscriptionSchema)

export default Subscription
