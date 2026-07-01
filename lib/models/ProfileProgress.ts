import { Schema, models, model, type Model } from "mongoose"

/**
 * Blocco 27 — persisted snapshot of a user's level + earned badges.
 *
 * Used purely to diff against freshly computed progress so we can fire a
 * notification the first time a badge is earned or a level is gained. Fully
 * additive: the existing Reputation model is left untouched.
 */
export interface IProfileProgress {
  userId: string
  level: number
  score: number
  badgeIds: string[]
  updatedAt: Date
  createdAt: Date
}

const ProfileProgressSchema = new Schema<IProfileProgress>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    level: { type: Number, default: 1 },
    score: { type: Number, default: 0 },
    badgeIds: { type: [String], default: [] },
  },
  { timestamps: true },
)

const ProfileProgress =
  (models.ProfileProgress as Model<IProfileProgress>) ||
  model<IProfileProgress>("ProfileProgress", ProfileProgressSchema)

export default ProfileProgress
