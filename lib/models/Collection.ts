import mongoose, { Schema, model, models } from "mongoose"

const CollectionItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    year: { type: Number, default: null },
    value: { type: Number, default: null },
    condition: { type: String, default: "", trim: true },
    image: { type: String, default: "", trim: true },
  },
  { timestamps: true },
)

const CollectionItem = models.CollectionItem || model("CollectionItem", CollectionItemSchema)

export default CollectionItem
