import { connectDB } from "@/lib/db"
import { isValidObjectId } from "mongoose"
import CreatorApplication from "@/lib/models/CreatorApplication"
import User from "@/lib/models/User"
import { activateCreator } from "@/lib/creator-affiliate"
import CreatorPartner from "@/lib/models/CreatorPartner"
import {
  notifyCreatorApplicationApproved,
  notifyCreatorApplicationRejected,
  notifyNewCreatorApplication,
} from "@/lib/creator-notifications"

/** Minimum social following required to qualify as a Creator Partner. */
export const MIN_INSTAGRAM_FOLLOWERS = 10000
export const MIN_TIKTOK_FOLLOWERS = 5000

export interface ApplyInput {
  userId: string
  instagramUrl?: string
  tiktokUrl?: string
  followerCountInstagram?: number | null
  followerCountTikTok?: number | null
  message?: string
}

/**
 * Checks whether the declared follower counts meet the minimum threshold.
 * The hard rule (per spec): IG >= 10k OR TikTok >= 5k.
 */
export function meetsFollowerRequirement(ig: number | null | undefined, tk: number | null | undefined): boolean {
  const igCount = Number(ig) || 0
  const tkCount = Number(tk) || 0
  return igCount >= MIN_INSTAGRAM_FOLLOWERS || tkCount >= MIN_TIKTOK_FOLLOWERS
}

export interface ApplyResult {
  ok: boolean
  error?: string
  status?: "pending" | "approved" | "rejected"
  autoRejected?: boolean
}

/**
 * Submits a Creator Partner application. Enforces: one active/pending request at
 * a time, not already a creator, account not blocked, and the follower minimum
 * (auto-rejected otherwise).
 */
export async function submitApplication(input: ApplyInput): Promise<ApplyResult> {
  await connectDB()
  const { userId } = input
  if (!isValidObjectId(userId)) return { ok: false, error: "Utente non valido." }

  const user = await User.findById(userId).select("_id blocked")
  if (!user) return { ok: false, error: "Utente non trovato." }
  if ((user as { blocked?: boolean }).blocked) {
    return { ok: false, error: "Il tuo account ha restrizioni di moderazione attive." }
  }

  // Already a creator?
  const existingPartner = await CreatorPartner.findOne({ creatorId: userId, active: true }).select("_id")
  if (existingPartner) return { ok: false, error: "Sei già un Creator Partner." }

  // A pending request blocks duplicates.
  const pending = await CreatorApplication.findOne({ userId, status: "pending" }).select("_id")
  if (pending) return { ok: false, error: "Hai già una richiesta in attesa di valutazione." }

  const ig = input.followerCountInstagram != null ? Math.max(0, Math.floor(Number(input.followerCountInstagram))) : null
  const tk = input.followerCountTikTok != null ? Math.max(0, Math.floor(Number(input.followerCountTikTok))) : null
  const instagramUrl = (input.instagramUrl || "").trim()
  const tiktokUrl = (input.tiktokUrl || "").trim()
  const socialLinks = [instagramUrl, tiktokUrl].filter(Boolean)

  // Auto-reject if the follower minimum is not met.
  const qualifies = meetsFollowerRequirement(ig, tk)
  const status = qualifies ? "pending" : "rejected"
  const decisionNote = qualifies
    ? ""
    : `Requisiti non soddisfatti: servono almeno ${MIN_INSTAGRAM_FOLLOWERS.toLocaleString("it-IT")} follower Instagram o ${MIN_TIKTOK_FOLLOWERS.toLocaleString("it-IT")} follower TikTok.`

  await CreatorApplication.create({
    userId,
    instagramUrl,
    tiktokUrl,
    socialLinks,
    followerCountInstagram: ig,
    followerCountTikTok: tk,
    message: (input.message || "").trim(),
    status,
    reviewedBy: qualifies ? null : "system",
    reviewedAt: qualifies ? null : new Date(),
    decisionNote,
  })

  if (!qualifies) {
    await notifyCreatorApplicationRejected(userId, decisionNote)
    return { ok: true, status: "rejected", autoRejected: true }
  }

  // Notify admins of the new pending request (fire-and-forget).
  const applicant = await User.findById(userId).select("username").lean()
  const applicantName = (applicant as { username?: string } | null)?.username || "Un utente"
  const admins = await User.find({ role: "admin" }).select("_id").lean()
  await Promise.all(
    admins.map((a) => notifyNewCreatorApplication(String((a as { _id: unknown })._id), applicantName)),
  )

  return { ok: true, status: "pending" }
}

export interface ApplicationStatus {
  hasApplication: boolean
  status: "pending" | "approved" | "rejected" | null
  isCreator: boolean
  decisionNote: string
  submittedAt: string | null
  reviewedAt: string | null
}

/** Returns the caller's most recent application status + creator state. */
export async function getApplicationStatus(userId: string): Promise<ApplicationStatus> {
  await connectDB()
  const [latest, partner] = await Promise.all([
    CreatorApplication.findOne({ userId }).sort({ createdAt: -1 }).lean(),
    CreatorPartner.findOne({ creatorId: userId, active: true }).select("_id").lean(),
  ])

  const app = latest as
    | { status?: string; decisionNote?: string; createdAt?: Date; reviewedAt?: Date | null }
    | null

  return {
    hasApplication: !!app,
    status: (app?.status as ApplicationStatus["status"]) ?? null,
    isCreator: !!partner,
    decisionNote: app?.decisionNote ?? "",
    submittedAt: app?.createdAt ? new Date(app.createdAt).toISOString() : null,
    reviewedAt: app?.reviewedAt ? new Date(app.reviewedAt).toISOString() : null,
  }
}

export interface AdminApplicationRow {
  id: string
  userId: string
  username: string
  email: string
  instagramUrl: string
  tiktokUrl: string
  socialLinks: string[]
  followerCountInstagram: number | null
  followerCountTikTok: number | null
  message: string
  status: string
  decisionNote: string
  submittedAt: string
  reviewedAt: string | null
}

/** Lists applications for the admin panel (optionally filtered by status). */
export async function listApplications(opts: { status?: string; limit?: number } = {}): Promise<AdminApplicationRow[]> {
  await connectDB()
  const query: Record<string, unknown> = {}
  if (opts.status && ["pending", "approved", "rejected"].includes(opts.status)) query.status = opts.status

  const rows = await CreatorApplication.find(query).sort({ createdAt: -1 }).limit(opts.limit ?? 200).lean()
  const ids = rows.map((r) => String((r as { userId: unknown }).userId))
  const users = await User.find({ _id: { $in: ids } }).select("username email").lean()
  const byId = new Map(users.map((u) => [String((u as { _id: unknown })._id), u as { username?: string; email?: string }]))

  return rows.map((r) => {
    const row = r as {
      _id: unknown
      userId: string
      instagramUrl?: string
      tiktokUrl?: string
      socialLinks?: string[]
      followerCountInstagram?: number | null
      followerCountTikTok?: number | null
      message?: string
      status: string
      decisionNote?: string
      createdAt?: Date
      reviewedAt?: Date | null
    }
    const u = byId.get(String(row.userId))
    return {
      id: String(row._id),
      userId: String(row.userId),
      username: u?.username || "Utente",
      email: u?.email || "",
      instagramUrl: row.instagramUrl || "",
      tiktokUrl: row.tiktokUrl || "",
      socialLinks: row.socialLinks || [],
      followerCountInstagram: row.followerCountInstagram ?? null,
      followerCountTikTok: row.followerCountTikTok ?? null,
      message: row.message || "",
      status: row.status,
      decisionNote: row.decisionNote || "",
      submittedAt: new Date(row.createdAt ?? Date.now()).toISOString(),
      reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
    }
  })
}

export interface DecisionResult {
  ok: boolean
  error?: string
  referralCode?: string
}

/**
 * Approves an application: marks it approved, records the reviewer, activates
 * the creator (generating a referral code + dashboard access), and notifies.
 */
export async function approveApplication(opts: {
  applicationId: string
  adminId: string
  commissionRate?: number
  commissionDurationMonths?: number
}): Promise<DecisionResult> {
  await connectDB()
  const { applicationId, adminId } = opts
  if (!isValidObjectId(applicationId)) return { ok: false, error: "ID richiesta non valido." }

  const app = await CreatorApplication.findById(applicationId)
  if (!app) return { ok: false, error: "Richiesta non trovata." }
  if (app.status !== "pending") return { ok: false, error: "Richiesta già gestita." }

  const partner = await activateCreator({
    creatorId: String(app.userId),
    commissionRate: opts.commissionRate,
    commissionDurationMonths: opts.commissionDurationMonths,
  })

  app.status = "approved"
  app.reviewedBy = adminId
  app.reviewedAt = new Date()
  app.decisionNote = ""
  await app.save()

  await notifyCreatorApplicationApproved(String(app.userId), partner.referralCode)
  return { ok: true, referralCode: partner.referralCode }
}

/** Rejects an application: marks it rejected, records the reviewer, notifies. */
export async function rejectApplication(opts: {
  applicationId: string
  adminId: string
  note?: string
}): Promise<DecisionResult> {
  await connectDB()
  const { applicationId, adminId, note = "" } = opts
  if (!isValidObjectId(applicationId)) return { ok: false, error: "ID richiesta non valido." }

  const app = await CreatorApplication.findById(applicationId)
  if (!app) return { ok: false, error: "Richiesta non trovata." }
  if (app.status !== "pending") return { ok: false, error: "Richiesta già gestita." }

  app.status = "rejected"
  app.reviewedBy = adminId
  app.reviewedAt = new Date()
  app.decisionNote = note.trim()
  await   app.save()

  await notifyCreatorApplicationRejected(String(app.userId), note.trim())
  return { ok: true }
}
