import { Schema, models, model } from "mongoose"

/**
 * Blocco 21 — AI valuation metadata for a collection object.
 *
 * Stored separately from the CollectionItem document (keyed by `objectId`)
 * so the existing Collection model is never modified. One AIMetadata doc per
 * collection item; re-running an analysis overwrites it in place.
 */

const HistoryPointSchema = new Schema(
  {
    date: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false },
)

const GradingSchema = new Schema(
  {
    score: { type: Number, default: 0 },
    label: { type: String, default: "" },
    defects: { type: [String], default: [] },
  },
  { _id: false },
)

const MarketValueSchema = new Schema(
  {
    estimated: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    trend: { type: String, enum: ["up", "stable", "down"], default: "stable" },
    forecast30d: { type: Number, default: 0 },
    history: { type: [HistoryPointSchema], default: [] },
  },
  { _id: false },
)

const DuplicatesSchema = new Schema(
  {
    total: { type: Number, default: 1 },
    recommendedForSale: { type: Number, default: 0 },
    recommendedForTrade: { type: Number, default: 0 },
    recommendedToKeep: { type: Number, default: 1 },
  },
  { _id: false },
)

const AdvisorSchema = new Schema(
  {
    sellNow: { type: Boolean, default: false },
    hold: { type: Boolean, default: true },
    auctionRecommended: { type: Boolean, default: false },
    tradeRecommended: { type: Boolean, default: false },
    reason: { type: String, default: "" },
  },
  { _id: false },
)

const AIMetadataSchema = new Schema(
  {
    // The CollectionItem _id this metadata describes (unique → one doc per item).
    objectId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    category: { type: String, default: "" },
    name: { type: String, default: "" },
    series: { type: String, default: null },
    set: { type: String, default: null },
    rarity: { type: String, default: null },
    number: { type: String, default: null },
    edition: { type: String, default: null },
    variants: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    grading: { type: GradingSchema, default: () => ({}) },
    marketValue: { type: MarketValueSchema, default: () => ({}) },
    duplicates: { type: DuplicatesSchema, default: () => ({}) },
    advisor: { type: AdvisorSchema, default: () => ({}) },
    // Confidence of the identification step (0–1), surfaced in the UI.
    confidence: { type: Number, default: 0 },
  },
  { timestamps: true },
)

const AIMetadata = models.AIMetadata || model("AIMetadata", AIMetadataSchema)

export default AIMetadata
