import mongoose, { Schema, models, model } from "mongoose"

const LockedCreditSchema = new Schema(
  {
    amount: { type: Number, required: true },
    source: { type: String, default: "Vendita", trim: true },
    releaseAt: { type: Date, required: true },
    released: { type: Boolean, default: false },
  },
  { _id: true },
)

const TransactionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["deposit", "withdraw", "sale", "purchase", "coins_purchase", "reward", "release"],
      required: true,
    },
    currency: { type: String, enum: ["money", "coins"], required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["completed", "pending", "locked"], default: "completed" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const WalletSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    money: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    badge: { type: String, enum: ["Base", "Gold", "Premium"], default: "Base" },
    itemsVisibility: { type: String, enum: ["public", "private"], default: "public" },
    lockedCredits: { type: [LockedCreditSchema], default: [] },
    transactions: { type: [TransactionSchema], default: [] },
    lastDailyReward: { type: Date, default: null },
    lastWeeklyReward: { type: Date, default: null },
    lastMonthlyReward: { type: Date, default: null },
    signupBonusClaimed: { type: Boolean, default: false },
  },
  { timestamps: true },
)

const Wallet = models.Wallet || model("Wallet", WalletSchema)

export default Wallet
