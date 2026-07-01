import { Schema, models, model } from "mongoose"

const TrackingEventSchema = new Schema(
  {
    status: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
)

const ShipmentSchema = new Schema(
  {
    escrowId: { type: Schema.Types.ObjectId, ref: "Escrow", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    carrier: { type: String, default: "CollexShip", trim: true },
    trackingNumber: { type: String, required: true, unique: true, index: true },
    insured: { type: Boolean, default: false },
    insuranceValue: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["created", "in_transit", "out_for_delivery", "delivered"],
      default: "created",
    },
    events: { type: [TrackingEventSchema], default: [] },
    estimatedDelivery: { type: Date, default: null },
  },
  { timestamps: true },
)

const Shipment = models.Shipment || model("Shipment", ShipmentSchema)

export default Shipment
