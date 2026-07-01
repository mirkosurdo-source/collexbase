import { Schema, models, model } from "mongoose"

// A protected payment held between buyer and seller for 48h.
const EscrowSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
    listingName: { type: String, default: "", trim: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    price: { type: Number, required: true },
    buyerFee: { type: Number, default: 0 },
    sellerFee: { type: Number, default: 0 },
    sellerNet: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["locked", "shipped", "released", "refunded"],
      default: "locked",
      index: true,
    },
    lockedAt: { type: Date, default: Date.now },
    releaseAt: { type: Date, required: true },
    releasedAt: { type: Date, default: null },
    shipmentId: { type: Schema.Types.ObjectId, ref: "Shipment", default: null },
  },
  { timestamps: true },
)

// Blocco 50 — maturity sweep finds locked escrows past their release date.
EscrowSchema.index({ status: 1, releaseAt: 1 })

const Escrow = models.Escrow || model("Escrow", EscrowSchema)

export default Escrow
