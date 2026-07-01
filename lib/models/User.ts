import mongoose, { Schema, models, model } from "mongoose"

// Blocco 49: a linked social-login provider (Google only, for now).
const SocialAuthSchema = new Schema(
  {
    provider: { type: String, enum: ["google"], required: true },
    providerId: { type: String, required: true },
    email: { type: String, trim: true },
    name: { type: String, trim: true },
    avatar: { type: String, trim: true },
    linkedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // Blocco 49: password is now optional so Google-only accounts can exist.
    password: { type: String },

    birthdate: { type: Date },
    address: { type: String, trim: true },
    bio: { type: String, trim: true },
    avatar: { type: String, trim: true },

    // Blocco 17: platform administration.
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    blocked: { type: Boolean, default: false, index: true },

    // Blocco 49: linked social-login providers.
    socialAuth: { type: [SocialAuthSchema], default: [] },

    // 🔥 NUOVO CAMPO: tracking attività utente
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

const User = models.User || model("User", UserSchema)

export default User
