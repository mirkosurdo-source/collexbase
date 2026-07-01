"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import LiveTimer from "@/components/live/LiveTimer"
import LiveChat, { type LiveChatMessage } from "@/components/live/LiveChat"

type Bid = { id: string; userId: string; username: string; amount: number; createdAt: string | null }
type LiveAuction = {
  id: string
  sellerId: string
  sellerUsername: string
  itemName: string
  description: string
  image: string
  startPrice: number
  currentPrice: number
  minIncrement: number
  highestBidderId: string | null
  highestBidderUsername: string
  status: "scheduled" | "live" | "ended" | "cancelled"
  endAt: string | null
  autoExtendSeconds: number
  extensionsCount: number
  isSeller: boolean
  isWinning: boolean
  bidCount: number
  bids: Bid[]
  chat: LiveChatMessage[]
  // Blocco 51 — non-payment fine.
  finalPrice: number | null
  winnerId: string | null
  paymentDeadline: string | null
  paymentStatus: "none" | "pending" | "paid" | "expired"
  finePercentage: number
  fineApplied: boolean
  fineAmountCollex: number
  isWinner: boolean
}

function jwt(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null
}

export default function LiveAuctionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""

  const [auction, setAuction] = useState<LiveAuction | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [bidAmount, setBidAmount] = useState("")
  const [bidError, setBidError] = useState("")
  const [chatError, setChatError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState("")
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState("")
  const prevPriceRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    const token = jwt()
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const res = await fetch(`/api/live-auction/status/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setAuction((prev) => {
          if (prev && data.auction.currentPrice > prev.currentPrice) {
            setFlash(`Nuova offerta: € ${data.auction.currentPrice}`)
            setTimeout(() => setFlash(""), 1800)
          }
          return data.auction
        })
      } else {
        setError(data.message || "Asta non trovata.")
      }
    } catch {
      setError("Impossibile caricare l'asta.")
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    load()
    const interval = setInterval(load, 2000)
    return () => clearInterval(interval)
  }, [load])

  const isLive = auction?.status === "live" && auction.endAt != null && new Date(auction.endAt).getTime() > Date.now()
  const minNext = auction ? auction.currentPrice + auction.minIncrement : 0

  async function placeBid(amount: number) {
    setBidError("")
    if (!Number.isFinite(amount) || amount <= 0) {
      setBidError("Inserisci un importo valido.")
      return
    }
    const token = jwt()
    if (!token) return router.replace("/login")
    setSubmitting(true)
    try {
      const res = await fetch("/api/live-auction/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, amount }),
      })
      const data = await res.json()
      if (data.success) {
        setAuction(data.auction)
        setBidAmount("")
        if (data.extended) {
          setFlash("Anti-sniping: tempo esteso!")
          setTimeout(() => setFlash(""), 1800)
        }
      } else {
        setBidError(data.message || "Offerta non riuscita.")
      }
    } catch {
      setBidError("Offerta non riuscita.")
    } finally {
      setSubmitting(false)
    }
  }

  async function sendChat(text: string) {
    setChatError("")
    const token = jwt()
    if (!token) return
    const res = await fetch("/api/live-auction/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, message: text }),
    })
    const data = await res.json()
    if (data.success) setAuction(data.auction)
    else setChatError(data.message || "Messaggio non inviato.")
  }

  async function payNow() {
    setPayError("")
    const token = jwt()
    if (!token) return router.replace("/login")
    setPaying(true)
    try {
      const res = await fetch("/api/live-auction/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.auction) setAuction(data.auction)
        setFlash("Pagamento completato!")
        setTimeout(() => setFlash(""), 1800)
      } else {
        setPayError(data.message || "Pagamento non riuscito.")
      }
    } catch {
      setPayError("Pagamento non riuscito.")
    } finally {
      setPaying(false)
    }
  }

  async function endAuction() {
    const token = jwt()
    if (!token) return
    if (!window.confirm("Vuoi terminare l'asta adesso?")) return
    const res = await fetch("/api/live-auction/end", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    if (data.success) setAuction(data.auction)
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }
  if (error || !auction) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Asta non trovata."}</p>
        <Link href="/live-auction" className="mt-4 inline-block text-sm font-medium underline">
          Torna alle aste live
        </Link>
      </div>
    )
  }

  const ended = !isLive

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-5xl px-4">
        <Link href="/live-auction" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Aste live
        </Link>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Item + price + bid (LivePrice / LiveItemPreview / LiveBidButton) */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                {auction.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={auction.image || "/placeholder.svg"} alt={auction.itemName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">Nessuna immagine</div>
                )}
                <span
                  className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isLive ? "bg-red-600 text-white" : "bg-neutral-800 text-neutral-100"
                  }`}
                >
                  {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />}
                  {isLive ? "LIVE" : "TERMINATA"}
                </span>
                {flash && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/90 px-4 py-1.5 text-xs font-medium text-white">
                    {flash}
                  </div>
                )}
              </div>

              <div className="p-5">
                <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{auction.itemName}</h1>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Venditore: {auction.sellerUsername || "—"}</p>
                {auction.description && (
                  <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{auction.description}</p>
                )}

                <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                  Multa mancato pagamento: {auction.finePercentage ?? 20}% del prezzo finale, applicata in CollexCoin
                  al wallet del vincitore se il pagamento non viene completato entro 48 ore. Il wallet può andare in
                  negativo (debito interno). Il prodotto verrà sbloccato al venditore dopo la scadenza.
                </p>

                <div className="mt-5 flex flex-wrap items-end justify-between gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                  <div>
                    <p className="text-xs text-neutral-400">Prezzo attuale</p>
                    <p className="text-3xl font-bold tabular-nums text-neutral-900 dark:text-neutral-50">€ {auction.currentPrice}</p>
                    {auction.highestBidderUsername && (
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        Migliore offerta: {auction.highestBidderUsername}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-400">Tempo rimanente</p>
                    {isLive ? (
                      <LiveTimer endAt={auction.endAt} urgentSeconds={10} onExpire={load} className="text-2xl" />
                    ) : (
                      <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Conclusa</p>
                    )}
                    {auction.extensionsCount > 0 && (
                      <p className="mt-0.5 text-xs text-neutral-400">{auction.extensionsCount} estensioni</p>
                    )}
                  </div>
                </div>

                {ended && auction.isWinner && auction.paymentStatus === "pending" && (
                  <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      Hai vinto questa asta! Completa il pagamento entro il termine.
                    </p>
                    {auction.paymentDeadline && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        Scadenza pagamento:{" "}
                        <span className="font-medium tabular-nums">
                          {new Date(auction.paymentDeadline).toLocaleString("it-IT")}
                        </span>
                      </p>
                    )}
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Se non paghi in tempo verrà applicata una multa di{" "}
                      <span className="font-semibold">{auction.fineAmountCollex} CollexCoin</span> al tuo wallet
                      (può andare in negativo) e il prodotto tornerà al venditore.
                    </p>
                    <button
                      onClick={payNow}
                      disabled={paying}
                      className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                    >
                      {paying ? "Elaborazione..." : `Paga ora € ${auction.finalPrice ?? auction.currentPrice}`}
                    </button>
                    {payError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{payError}</p>}
                  </div>
                )}

                {ended && auction.isWinner && auction.paymentStatus === "paid" && (
                  <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
                    Pagamento completato. Grazie! L&apos;ordine è stato finalizzato.
                  </div>
                )}

                {ended && auction.isWinner && auction.paymentStatus === "expired" && (
                  <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                    Termine di pagamento scaduto. È stata applicata una multa di {auction.fineAmountCollex} CollexCoin
                    al tuo wallet e il prodotto è tornato al venditore.
                  </div>
                )}

                {ended && auction.isSeller && auction.paymentStatus === "expired" && (
                  <div className="mt-4 rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
                    L&apos;acquirente non ha pagato in tempo. Il prodotto è stato sbloccato: puoi rimetterlo in asta,
                    venderlo o tenerlo.
                  </div>
                )}

                {isLive && !auction.isSeller && (
                  <BidForm
                    bidAmount={bidAmount}
                    setBidAmount={setBidAmount}
                    minNext={minNext}
                    submitting={submitting}
                    bidError={bidError}
                    onQuick={() => placeBid(minNext)}
                    onSubmit={(e) => {
                      e.preventDefault()
                      placeBid(Number(bidAmount))
                    }}
                  />
                )}

                {isLive && auction.isSeller && (
                  <div className="mt-5 flex flex-col gap-2">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Sei il venditore di questa asta.</p>
                    <button
                      onClick={endAuction}
                      className="self-start rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Termina asta ora
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* LiveBidsList */}
            <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Offerte ({auction.bidCount})</h2>
              {auction.bids.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Nessuna offerta ancora.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
                  {auction.bids.map((bid, index) => (
                    <li key={bid.id || index} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{bid.username || "Utente"}</span>
                        {index === 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-400">
                            Migliore
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">€ {bid.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* LiveChat */}
          <div className="lg:col-span-1">
            <LiveChat
              messages={auction.chat}
              currentUserId={auction.isSeller ? auction.sellerId : auction.highestBidderId || ""}
              onSend={sendChat}
              disabled={auction.status === "cancelled"}
              error={chatError}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function BidForm({
  bidAmount,
  setBidAmount,
  minNext,
  submitting,
  bidError,
  onQuick,
  onSubmit,
}: {
  bidAmount: string
  setBidAmount: (v: string) => void
  minNext: number
  submitting: boolean
  bidError: string
  onQuick: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          placeholder={`Min. € ${minNext}`}
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        />
        <button
          type="submit"
          disabled={submitting}
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {submitting ? "Invio..." : "Offri"}
        </button>
      </div>
      <button
        type="button"
        onClick={onQuick}
        disabled={submitting}
        className="self-start rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        Offri il minimo (€ {minNext})
      </button>
      {bidError && <p className="text-sm text-red-600 dark:text-red-400">{bidError}</p>}
    </form>
  )
}
