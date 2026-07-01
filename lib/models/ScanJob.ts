import { Schema, models, model } from "mongoose"

/**
 * Blocco 40 — advanced 3D/OCR scanner job.
 *
 * Persists a professional grading analysis (identification, centering, corners,
 * edges, surface, defects, authenticity and PSA-tier market value). Stored in
 * its own collection so nothing in the existing Collection / AIMetadata models
 * is touched — this block is fully additive on top of Blocco 21.
 */

const CardIdentifiedSchema = new Schema(
  {
    name: { type: String, default: "" },
    set: { type: String, default: "" },
    number: { type: String, default: "" },
    year: { type: Number, default: 0 },
    variant: { type: String, default: "" },
    imageMatchConfidence: { type: Number, default: 0 },
  },
  { _id: false },
)

const GradingSchema = new Schema(
  {
    overall: { type: Number, default: 0 },
    centering: { type: Number, default: 0 },
    corners: { type: Number, default: 0 },
    edges: { type: Number, default: 0 },
    surface: { type: Number, default: 0 },
  },
  { _id: false },
)

const CenteringSchema = new Schema(
  {
    left: { type: Number, default: 50 },
    right: { type: Number, default: 50 },
    top: { type: Number, default: 50 },
    bottom: { type: Number, default: 50 },
    percent: { type: Number, default: 0 },
    deviation: { type: Number, default: 0 },
  },
  { _id: false },
)

const DefectsSchema = new Schema(
  {
    whitening: { type: Number, default: 0 },
    scratches: { type: Number, default: 0 },
    dents: { type: Number, default: 0 },
    edgeWear: { type: Number, default: 0 },
    holoScratches: { type: Number, default: 0 },
    printLines: { type: Number, default: 0 },
  },
  { _id: false },
)

const AuthenticitySchema = new Schema(
  {
    holoPattern: { type: Number, default: 0 },
    printPattern: { type: Number, default: 0 },
    fontMatch: { type: Number, default: 0 },
    borderMatch: { type: Number, default: 0 },
    authenticityScore: { type: Number, default: 0 },
  },
  { _id: false },
)

const MarketValueSchema = new Schema(
  {
    raw: { type: Number, default: 0 },
    graded: { type: Number, default: 0 },
    grade10: { type: Number, default: 0 },
    grade9: { type: Number, default: 0 },
    grade8: { type: Number, default: 0 },
    history: {
      type: [{ date: { type: String }, value: { type: Number } }],
      default: [],
    },
  },
  { _id: false },
)

const ResultSchema = new Schema(
  {
    cardIdentified: { type: CardIdentifiedSchema, default: () => ({}) },
    grading: { type: GradingSchema, default: () => ({}) },
    centering: { type: CenteringSchema, default: () => ({}) },
    defects: { type: DefectsSchema, default: () => ({}) },
    authenticity: { type: AuthenticitySchema, default: () => ({}) },
    marketValue: { type: MarketValueSchema, default: () => ({}) },
    notes: { type: String, default: "" },
  },
  { _id: false },
)

const ScanJobSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    images: { type: [String], default: [] },
    category: { type: String, default: "carte" },
    result: { type: ResultSchema, default: null },
    error: { type: String, default: "" },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

// Daily-limit queries filter by user + creation time.
ScanJobSchema.index({ userId: 1, createdAt: -1 })

const ScanJob = models.ScanJob || model("ScanJob", ScanJobSchema)

export default ScanJob
