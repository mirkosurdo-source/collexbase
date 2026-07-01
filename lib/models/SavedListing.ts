import { Schema, models, model } from "mongoose"

const SavedListingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true, index: true },
  },
  { timestamps: true },
)

SavedListingSchema.index({ userId: 1, listingId: 1 }, { unique: true })

const SavedListing = models.SavedListing || model("SavedListing", SavedListingSchema)

export default SavedListing
