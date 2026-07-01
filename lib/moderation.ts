import { generateText, Output } from "ai"
import { z } from "zod"
import { connectDB } from "@/lib/db"
import ModerationEvent, { type MODERATION_TARGET_TYPES, type MODERATION_SEVERITIES } from "@/lib/models/ModerationEvent"
import { notifyContentModerated, notifyListingFlagged, notifyRiskyTrade } from "@/lib/moderation-notifications"

/**
 * Blocco 37 — Automatic AI moderation engine.
 *
 * Pure, self-contained analysis utilities + a thin persistence helper. This
 * module is fully additive: it never imports or mutates the marketplace,
 * auction, trade, showcase, community, group, chat, advisor, coins, stripe,
 * auth or analytics engines. Other code may *optionally* call `moderateText`
 * / `moderateImage` as fire-and-forget hooks, but nothing here is required for
 * those engines to function.
 */

// Vision + text capable, zero-config through the Vercel AI Gateway.
const TEXT_MODEL = "openai/gpt-4o-mini"
const VISION_MODEL = "openai/gpt-4o"

export type TargetType = (typeof MODERATION_TARGET_TYPES)[number]
export type Severity = (typeof MODERATION_SEVERITIES)[number]

export type ModerationCategory =
  | "toxic"
  | "threat"
  | "prohibited"
  | "spam"
  | "phishing"
  | "scam"
  | "sensitive"
  | "fraud"
  | "suspicious_profile"
  | "auction_abuse"
  | "trade_abuse"
  | "clean"
  | "other"

export interface ModerationVerdict {
  flagged: boolean
  category: ModerationCategory
  severity: Severity
  reason: string
  /** 0..1 confidence the content is problematic. */
  score: number
}

const CLEAN: ModerationVerdict = {
  flagged: false,
  category: "clean",
  severity: "low",
  reason: "Nessun problema rilevato.",
  score: 0,
}

/* -------------------------------------------------------------------------- */
/* Heuristics (DB-free, deterministic, no network)                            */
/* -------------------------------------------------------------------------- */

const TOXIC_WORDS = [
  "idiota",
  "stupido",
  "cretino",
  "imbecille",
  "deficiente",
  "bastardo",
  "stronzo",
  "merda",
  "vaffanculo",
  "schifoso",
  "ti ammazzo",
  "ti uccido",
  "muori",
]

const SCAM_PATTERNS = [
  /pagamento\s+(anticipato|in\s+anticipo)/i,
  /solo\s+(paypal\s+)?amici\s+e\s+famiglia/i,
  /friends\s*&?\s*family/i,
  /western\s+union/i,
  /buoni?\s+(amazon|google\s+play|postepay)/i,
  /ricarica\s+postepay/i,
  /bonifico\s+(urgente|immediato)/i,
  /contattami\s+su\s+(whatsapp|telegram)/i,
  /\bgift\s*card\b/i,
]

const PHISHING_PATTERNS = [
  /verifica\s+il\s+tuo\s+account/i,
  /clicca\s+(qui|sul\s+link)/i,
  /il\s+tuo\s+account\s+(sarà|verrà)\s+(sospeso|bloccato)/i,
  /inserisci\s+(la\s+)?password/i,
  /https?:\/\/(bit\.ly|tinyurl|t\.co|cutt\.ly)/i,
]

const LINK_RE = /https?:\/\/[^\s]+/gi
const REPEAT_CHAR_RE = /(.)\1{6,}/

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function severityFromScore(score: number): Severity {
  if (score >= 0.85) return "critical"
  if (score >= 0.6) return "high"
  if (score >= 0.35) return "medium"
  return "low"
}

/** Fast, offline text heuristics used as a first pass / AI fallback. */
export function analyzeTextHeuristics(text: string): ModerationVerdict {
  const value = (text || "").trim()
  if (!value) return CLEAN
  const lower = value.toLowerCase()

  for (const re of PHISHING_PATTERNS) {
    if (re.test(value)) {
      return { flagged: true, category: "phishing", severity: "high", reason: "Possibile tentativo di phishing.", score: 0.8 }
    }
  }
  for (const re of SCAM_PATTERNS) {
    if (re.test(value)) {
      return { flagged: true, category: "scam", severity: "high", reason: "Pattern di pagamento sospetto/truffa.", score: 0.78 }
    }
  }

  const toxicHits = TOXIC_WORDS.filter((w) => lower.includes(w))
  if (toxicHits.some((w) => w.includes("ammazzo") || w.includes("uccido") || w === "muori")) {
    return { flagged: true, category: "threat", severity: "critical", reason: "Minaccia esplicita rilevata.", score: 0.95 }
  }
  if (toxicHits.length > 0) {
    const score = clamp01(0.45 + toxicHits.length * 0.12)
    return { flagged: true, category: "toxic", severity: severityFromScore(score), reason: "Linguaggio offensivo o tossico.", score }
  }

  // Spam signals: many links, repeated chars, ALL CAPS shouting.
  const links = value.match(LINK_RE) || []
  const caps = value.replace(/[^A-Za-z]/g, "")
  const capsRatio = caps ? caps.replace(/[^A-Z]/g, "").length / caps.length : 0
  let spamScore = 0
  if (links.length >= 3) spamScore += 0.5
  if (REPEAT_CHAR_RE.test(value)) spamScore += 0.3
  if (value.length > 24 && capsRatio > 0.7) spamScore += 0.3
  if (spamScore >= 0.5) {
    return { flagged: true, category: "spam", severity: severityFromScore(spamScore), reason: "Contenuto con caratteristiche di spam.", score: clamp01(spamScore) }
  }

  return CLEAN
}

/* -------------------------------------------------------------------------- */
/* AI analysis (best-effort, falls back to heuristics)                         */
/* -------------------------------------------------------------------------- */

const verdictSchema = z.object({
  flagged: z.boolean().describe("true se il contenuto viola le regole della piattaforma"),
  category: z
    .enum(["toxic", "threat", "prohibited", "spam", "phishing", "scam", "sensitive", "fraud", "clean", "other"])
    .describe("categoria principale del problema"),
  severity: z.enum(["low", "medium", "high", "critical"]).describe("gravità della violazione"),
  reason: z.string().describe("breve spiegazione in italiano, max 140 caratteri"),
  score: z.number().min(0).max(1).describe("confidenza che il contenuto sia problematico"),
})

/**
 * Analyzes free text for prohibited content, toxicity, spam, phishing and
 * scams. Uses the AI Gateway when available and silently falls back to the
 * offline heuristics if the model call fails (so callers never break).
 */
export async function moderateText(text: string): Promise<ModerationVerdict> {
  const value = (text || "").trim()
  if (!value) return CLEAN

  // Cheap pre-filter: obvious critical hits short-circuit the AI call.
  const heuristic = analyzeTextHeuristics(value)
  if (heuristic.flagged && heuristic.severity === "critical") return heuristic

  try {
    const { output } = await generateText({
      model: TEXT_MODEL,
      output: Output.object({ schema: verdictSchema }),
      messages: [
        {
          role: "system",
          content:
            "Sei il moderatore automatico di CollexBase, un marketplace di collezionismo. " +
            "Valuti testi (post, commenti, messaggi) e rilevi: insulti, minacce, contenuti vietati o illegali, " +
            "spam, phishing, truffe e linguaggio tossico. Sii rigoroso ma non segnalare contenuti legittimi sul collezionismo.",
        },
        { role: "user", content: value.slice(0, 4000) },
      ],
    })
    return {
      flagged: output.flagged,
      category: output.category as ModerationCategory,
      severity: output.severity,
      reason: output.reason || "Contenuto segnalato dalla moderazione AI.",
      score: clamp01(output.score),
    }
  } catch (err) {
    console.error("[v0] moderateText AI fallback:", err)
    return heuristic
  }
}

/**
 * Analyzes an image (listing/showcase/group/profile photo) for prohibited,
 * sensitive, illegal or fraudulent content. Falls back to "clean" on failure.
 */
export async function moderateImage(imageUrl: string): Promise<ModerationVerdict> {
  const url = (imageUrl || "").trim()
  if (!url) return CLEAN

  const mediaType = url.split("?")[0].toLowerCase().endsWith(".png")
    ? "image/png"
    : url.split("?")[0].toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/jpeg"

  try {
    const { output } = await generateText({
      model: VISION_MODEL,
      output: Output.object({ schema: verdictSchema }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Modera questa immagine per CollexBase (marketplace di collezionismo). Rileva contenuti vietati, " +
                "sensibili, illegali, non adatti alla piattaforma, immagini fraudolente o watermark sospetti. " +
                "Le foto legittime di oggetti da collezione sono 'clean'.",
            },
            { type: "file", data: url, mediaType },
          ],
        },
      ],
    })
    return {
      flagged: output.flagged,
      category: output.category as ModerationCategory,
      severity: output.severity,
      reason: output.reason || "Immagine segnalata dalla moderazione AI.",
      score: clamp01(output.score),
    }
  } catch (err) {
    console.error("[v0] moderateImage AI fallback:", err)
    return CLEAN
  }
}

/* -------------------------------------------------------------------------- */
/* Marketplace / auction / trade heuristics                                    */
/* -------------------------------------------------------------------------- */

export interface ListingSignal {
  price?: number
  estimatedValue?: number
  title?: string
  description?: string
  duplicateCount?: number
}

/** Detects suspicious prices, scam wording and duplicate/fake listings. */
export function analyzeListing(signal: ListingSignal): ModerationVerdict {
  const text = `${signal.title || ""} ${signal.description || ""}`.trim()
  const textVerdict = analyzeTextHeuristics(text)
  if (textVerdict.flagged && (textVerdict.category === "scam" || textVerdict.category === "phishing")) {
    return { ...textVerdict, category: "scam" }
  }

  const price = Number(signal.price || 0)
  const value = Number(signal.estimatedValue || 0)
  if (value > 0 && price > 0) {
    const ratio = price / value
    // A price wildly below market is a classic bait/scam signal.
    if (ratio <= 0.15) {
      return { flagged: true, category: "scam", severity: "high", reason: "Prezzo sospettosamente basso rispetto al valore stimato.", score: 0.75 }
    }
    if (ratio >= 8) {
      return { flagged: true, category: "fraud", severity: "medium", reason: "Prezzo anomalo molto superiore al valore di mercato.", score: 0.55 }
    }
  }

  if ((signal.duplicateCount || 0) >= 4) {
    return { flagged: true, category: "spam", severity: "medium", reason: "Annuncio duplicato più volte.", score: 0.5 }
  }

  return textVerdict.flagged ? textVerdict : CLEAN
}

export interface TradeSignal {
  offeredValue?: number
  requestedValue?: number
  message?: string
}

/** Flags lopsided or scammy trade proposals. */
export function analyzeTrade(signal: TradeSignal): ModerationVerdict {
  const textVerdict = analyzeTextHeuristics(signal.message || "")
  if (textVerdict.flagged) return textVerdict

  const offered = Number(signal.offeredValue || 0)
  const requested = Number(signal.requestedValue || 0)
  if (offered > 0 && requested > 0) {
    const ratio = requested / offered
    if (ratio >= 5) {
      return { flagged: true, category: "trade_abuse", severity: "medium", reason: "Scambio fortemente sbilanciato: rischio elevato.", score: 0.6 }
    }
  }
  return CLEAN
}

export interface AuctionSignal {
  bidCount?: number
  uniqueBidders?: number
  startingPrice?: number
  currentPrice?: number
}

/** Detects shill-bidding / manipulated auction patterns. */
export function analyzeAuction(signal: AuctionSignal): ModerationVerdict {
  const bids = Number(signal.bidCount || 0)
  const bidders = Number(signal.uniqueBidders || 0)
  // Many bids from very few accounts is a classic shill-bidding signal.
  if (bids >= 8 && bidders > 0 && bidders <= 2) {
    return { flagged: true, category: "auction_abuse", severity: "high", reason: "Possibile shill bidding: molti rilanci da pochi account.", score: 0.72 }
  }
  return CLEAN
}

export interface ProfileSignal {
  accountAgeDays?: number
  postsLastHour?: number
  messagesLastHour?: number
  reportsReceived?: number
  duplicateDeviceAccounts?: number
}

/** Flags bots, spammers, fake profiles and suspicious multi-accounting. */
export function analyzeProfile(signal: ProfileSignal): ModerationVerdict {
  let score = 0
  const reasons: string[] = []

  if ((signal.postsLastHour || 0) >= 20) {
    score += 0.4
    reasons.push("attività di pubblicazione anomala")
  }
  if ((signal.messagesLastHour || 0) >= 60) {
    score += 0.4
    reasons.push("invio massivo di messaggi")
  }
  if ((signal.accountAgeDays ?? 999) < 1 && ((signal.postsLastHour || 0) > 5 || (signal.messagesLastHour || 0) > 15)) {
    score += 0.3
    reasons.push("account appena creato molto attivo")
  }
  if ((signal.reportsReceived || 0) >= 3) {
    score += 0.3
    reasons.push("segnalazioni multiple ricevute")
  }
  if ((signal.duplicateDeviceAccounts || 0) >= 2) {
    score += 0.3
    reasons.push("possibili multi-account dallo stesso dispositivo")
  }

  if (score >= 0.35) {
    return {
      flagged: true,
      category: "suspicious_profile",
      severity: severityFromScore(clamp01(score)),
      reason: `Profilo sospetto: ${reasons.join(", ")}.`,
      score: clamp01(score),
    }
  }
  return CLEAN
}

/* -------------------------------------------------------------------------- */
/* CollexSpark "Moderatore" voice                                              */
/* -------------------------------------------------------------------------- */

export interface SparkModeration {
  /** Reuses the existing CollexSpark "alert" pose (no new assets required). */
  pose: "alert"
  message: string
}

/** Returns a CollexSpark moderator line for a verdict (presentational). */
export function sparkForVerdict(verdict: ModerationVerdict): SparkModeration {
  const byCategory: Partial<Record<ModerationCategory, string>> = {
    scam: "⚠ Questo annuncio sembra sospetto.",
    fraud: "⚠ Ho rilevato un possibile contenuto fraudolento.",
    trade_abuse: "⚠ Questo scambio ha un rischio elevato.",
    auction_abuse: "⚠ Questa asta mostra rilanci sospetti.",
    toxic: "⚠ Questo contenuto viola le regole della community.",
    threat: "⚠ Ho rilevato una minaccia: contenuto bloccato.",
    prohibited: "⚠ Ho rilevato un contenuto non conforme.",
    phishing: "⚠ Attenzione: possibile tentativo di phishing.",
    spam: "⚠ Questo contenuto sembra spam.",
    sensitive: "⚠ Questa immagine potrebbe non essere adatta.",
    suspicious_profile: "⚠ Questo profilo mostra attività sospette.",
  }
  return { pose: "alert", message: byCategory[verdict.category] || "⚠ Ho rilevato un contenuto da verificare." }
}

/* -------------------------------------------------------------------------- */
/* Persistence + orchestration                                                 */
/* -------------------------------------------------------------------------- */

export interface RecordEventInput {
  userId: string
  username?: string
  targetType: TargetType
  targetId?: string
  verdict: ModerationVerdict
  excerpt?: string
  /** Whether the calling surface already hid/removed the content. */
  autoActioned?: boolean
  /** Send a user notification about the action. Defaults to true when flagged. */
  notify?: boolean
}

/**
 * Persists a ModerationEvent when a verdict is flagged and (optionally) fires a
 * user notification. Non-throwing: any failure is logged so it can be used as a
 * fire-and-forget hook from existing routes without affecting their flow.
 * Returns the created event id, or null when nothing was recorded.
 */
export async function recordModerationEvent(input: RecordEventInput): Promise<string | null> {
  try {
    if (!input.verdict?.flagged || !input.userId) return null
    await connectDB()

    const doc = await ModerationEvent.create({
      userId: input.userId,
      username: input.username || "",
      targetType: input.targetType,
      targetId: input.targetId || "",
      severity: input.verdict.severity,
      category: input.verdict.category,
      reason: input.verdict.reason,
      excerpt: (input.excerpt || "").slice(0, 280),
      aiScore: clamp01(input.verdict.score),
      autoActioned: Boolean(input.autoActioned),
      resolved: false,
    })

    const shouldNotify = input.notify ?? true
    if (shouldNotify) {
      if (input.targetType === "market") {
        await notifyListingFlagged(input.userId, input.targetId || "", input.verdict.reason)
      } else if (input.targetType === "trade") {
        await notifyRiskyTrade(input.userId, input.targetId || "")
      } else {
        await notifyContentModerated(input.userId, input.targetType, input.verdict.reason, input.autoActioned)
      }
    }

    return String(doc._id)
  } catch (err) {
    console.error("[v0] recordModerationEvent error:", err)
    return null
  }
}

/**
 * Convenience: analyze a piece of text and record an event in one call. Returns
 * the verdict so the caller can decide whether to hide content immediately.
 */
export async function moderateAndRecordText(
  text: string,
  ctx: { userId: string; username?: string; targetType: TargetType; targetId?: string; autoHideAt?: Severity },
): Promise<ModerationVerdict> {
  const verdict = await moderateText(text)
  if (verdict.flagged) {
    const order: Severity[] = ["low", "medium", "high", "critical"]
    const autoActioned = ctx.autoHideAt ? order.indexOf(verdict.severity) >= order.indexOf(ctx.autoHideAt) : false
    await recordModerationEvent({
      userId: ctx.userId,
      username: ctx.username,
      targetType: ctx.targetType,
      targetId: ctx.targetId,
      verdict,
      excerpt: text,
      autoActioned,
    })
  }
  return verdict
}
