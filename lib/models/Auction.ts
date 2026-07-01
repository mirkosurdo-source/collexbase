import { Schema, model, models } from "mongoose"

const BidSchema = new Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, default: "" },
    amount: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

const AuctionSchema = new Schema(
  {
    userId: { type: String, required: true },
    itemName: { type: String, required: true },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    startingPrice: { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    minIncrement: { type: Number, required: true, default: 1 },
    highestBidderId: { type: String, default: "" },
    bids: { type: [BidSchema], default: [] },
    status: { type: String, enum: ["active", "closed"], default: "active" },
    endsAt: { type: Date, required: true },
  },
  { timestamps: true },
)

const Auction = models.Auction || model("Auction", AuctionSchema)

export default Auction
