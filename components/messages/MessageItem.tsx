"use client"

export interface OfferItem {
  id: string
  name: string
  image: string
  value: number
}

export interface Offer {
  _id: string
  offerType: "cash" | "item_cash" | "item_coins" | "multi_trade"
  proposerId: string
  amount: number
  coins: number
  offeredItems: OfferItem[]
  requestedItems: OfferItem[]
  listingName?: string
  askValue: number
  offerValue: number
  status: "pending" | "accepted" | "rejected" | "withdrawn" | "countered"
  aiScore: number
  aiVerdict: string
  aiMessage: string
  aiSuggestedCounter: number
}

export interface ChatMessage {
  _id: string
  senderId: string
  senderUsername: string
  type: "text" | "image" | "attachment" | "offer"
  text: string
  imageUrl: string
  attachment: { url: string; name: string; size: number; contentType: string } | null
  offer: Offer | null
  createdAt: string
  mine: boolean
  readByOther: boolean
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const OFFER_TYPE_LABEL: Record<Offer["offerType"], string> = {
  cash: "Offerta in denaro",
  item_cash: "Oggetto + denaro",
  item_coins: "Oggetto + CollexCoins",
  multi_trade: "Scambio multiplo",
}

const STATUS_BADGE: Record<Offer["status"], { label: string; cls: string }> = {
  pending: { label: "In attesa", cls: "bg-chart-4/15 text-chart-4" },
  accepted: { label: "Accettata", cls: "bg-chart-2/15 text-chart-2" },
  rejected: { label: "Rifiutata", cls: "bg-destructive/15 text-destructive" },
  withdrawn: { label: "Ritirata", cls: "bg-muted text-muted-foreground" },
  countered: { label: "Controproposta", cls: "bg-primary/15 text-primary" },
}

const VERDICT_TONE: Record<string, string> = {
  ottima: "text-chart-2",
  equa: "text-foreground",
  sfavorevole: "text-chart-4",
  "molto sfavorevole": "text-destructive",
}

interface Props {
  message: ChatMessage
  currentUserId: string
  onPreviewImage: (url: string) => void
  onAccept: (messageId: string) => void
  onReject: (messageId: string) => void
  onWithdraw: (messageId: string) => void
  onCounter: (messageId: string) => void
  busy: boolean
}

export default function MessageItem({
  message: m,
  currentUserId,
  onPreviewImage,
  onAccept,
  onReject,
  onWithdraw,
  onCounter,
  busy,
}: Props) {
  const mine = m.mine
  const bubbleBase = mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"
  const timeTone = mine ? "text-primary-foreground/70" : "text-muted-foreground"

  // Offer messages render as a full card regardless of sender.
  if (m.type === "offer" && m.offer) {
    return <OfferCard m={m} currentUserId={currentUserId} {...{ onAccept, onReject, onWithdraw, onCounter, busy }} />
  }

  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${bubbleBase}`}>
        {m.type === "image" && m.imageUrl && (
          <button onClick={() => onPreviewImage(m.imageUrl)} className="mb-1 block overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.imageUrl || "/placeholder.svg"} alt="Immagine inviata" className="max-h-64 w-full object-cover" />
          </button>
        )}

        {m.type === "attachment" && m.attachment && (
          <a
            href={m.attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`mb-1 flex items-center gap-2 rounded-lg p-2 ${mine ? "bg-primary-foreground/15" : "bg-background"}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${mine ? "bg-primary-foreground/20" : "bg-muted"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{m.attachment.name}</span>
              <span className={`block text-xs ${timeTone}`}>{formatSize(m.attachment.size)}</span>
            </span>
          </a>
        )}

        {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}

        <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${timeTone}`}>
          {formatTime(m.createdAt)}
          {mine && <span>{m.readByOther ? "✓✓" : "✓"}</span>}
        </span>
      </div>
    </li>
  )
}

function OfferCard({
  m,
  currentUserId,
  onAccept,
  onReject,
  onWithdraw,
  onCounter,
  busy,
}: {
  m: ChatMessage
  currentUserId: string
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onWithdraw: (id: string) => void
  onCounter: (id: string) => void
  busy: boolean
}) {
  const offer = m.offer as Offer
  const isProposer = offer.proposerId === currentUserId
  const status = STATUS_BADGE[offer.status]
  const canRespond = offer.status === "pending" && !isProposer
  const canWithdraw = offer.status === "pending" && isProposer

  return (
    <li className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
      <div className="w-full max-w-[88%] overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-semibold text-foreground">{OFFER_TYPE_LABEL[offer.offerType]}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
        </div>

        <div className="space-y-3 px-3 py-3">
          {m.text && <p className="text-sm text-foreground">{m.text}</p>}

          <div className="flex flex-wrap gap-3 text-sm">
            {offer.amount > 0 && (
              <span className="font-medium text-foreground">{`€ ${offer.amount.toLocaleString("it-IT")}`}</span>
            )}
            {offer.coins > 0 && (
              <span className="font-medium text-foreground">{`${offer.coins.toLocaleString("it-IT")} Coins`}</span>
            )}
          </div>

          {offer.offeredItems.length > 0 && (
            <ItemRow label="Offerti" items={offer.offeredItems} />
          )}
          {offer.requestedItems.length > 0 && (
            <ItemRow label="Richiesti" items={offer.requestedItems} />
          )}

          {/* AI advisor card */}
          <div className="rounded-lg border border-border bg-muted/40 p-2.5">
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Advisor</p>
            <p className={`text-sm font-medium ${VERDICT_TONE[offer.aiVerdict] || "text-foreground"}`}>
              {`Equità: ${offer.aiVerdict || "n/d"} · punteggio ${offer.aiScore}/100`}
            </p>
            {offer.aiMessage && <p className="mt-0.5 text-xs text-muted-foreground">{offer.aiMessage}</p>}
            {offer.status === "pending" && !isProposer && offer.aiSuggestedCounter > 0 && (
              <p className="mt-1 text-xs text-foreground">
                {`Controproposta suggerita: ~ € ${offer.aiSuggestedCounter.toLocaleString("it-IT")}.`}
              </p>
            )}
          </div>

          {(canRespond || canWithdraw) && (
            <div className="flex flex-wrap gap-2">
              {canRespond && (
                <>
                  <button
                    onClick={() => onAccept(offer._id)}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Accetta
                  </button>
                  <button
                    onClick={() => onCounter(offer._id)}
                    disabled={busy}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    Controproponi
                  </button>
                  <button
                    onClick={() => onReject(offer._id)}
                    disabled={busy}
                    className="flex-1 rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Rifiuta
                  </button>
                </>
              )}
              {canWithdraw && (
                <button
                  onClick={() => onWithdraw(offer._id)}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  Ritira offerta
                </button>
              )}
            </div>
          )}

          <span className="block text-right text-[10px] text-muted-foreground">{formatTime(m.createdAt)}</span>
        </div>
      </div>
    </li>
  )
}

function ItemRow({ label, items }: { label: string; items: OfferItem[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((it, idx) => (
          <span key={`${it.id}-${idx}`} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1">
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-muted">
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image || "/placeholder.svg"} alt="" className="h-full w-full object-cover" />
              ) : null}
            </span>
            <span className="text-xs font-medium text-foreground">{it.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
