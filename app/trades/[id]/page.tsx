"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import ContactChatButton from "@/components/chat/ContactChatButton"
import WishlistMatchBadge from "@/components/wishlist/WishlistMatchBadge"
import ReviewPromptCard from "@/components/reviews/ReviewPromptCard"

type Message = {
  _id?: string
  senderId: string
  senderUsername?: string
  text: string
  createdAt: string
}

type Trade = {
  _id: string
  fromUserId: string
  fromUsername?: string
  toUserId: string
  toUsername?: string
  offeredItemName?: string
  offeredItemImage?: string
  requestedItemName?: string
  requestedItemImage?: string
  message?: string
  status: "pending" | "accepted" | "rejected"
  messages: Message[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  accepted: "Accettato",
  rejected: "Rifiutato",
}

function statusClasses(status: string): string {
  switch (status) {
    case "accepted":
      return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
    case "rejected":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
  }
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

function ItemCard({ label, name, image }: { label: string; name?: string; image?: string }) {
  return (
    <div className="flex-1">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image || "/placeholder.svg"} alt={name || ""} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
              Nessuna immagine
            </div>
          )}
        </div>
        <p className="truncate p-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">{name || "Oggetto"}</p>
      </div>
    </div>
  )
}

export default function TradeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""

  const [trade, setTrade] = useState<Trade | null>(null)
  const [userId, setUserId] = useState("")
  const [isRecipient, setIsRecipient] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [chatText, setChatText] = useState("")
  const [sending, setSending] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const loadTrade = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const res = await fetch(`/api/trades/item?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setTrade(data.trade)
        setUserId(data.userId)
        setIsRecipient(data.isRecipient)
      } else {
        setError(data.message || "Scambio non trovato.")
      }
    } catch {
      setError("Impossibile caricare lo scambio.")
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    loadTrade()
  }, [loadTrade])

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [trade?.messages.length, showChat])

  async function handleAction(action: "accept" | "reject") {
    setActionError("")
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }
    try {
      const res = await fetch(`/api/trades/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        setTrade(data.trade)
      } else {
        setActionError(data.message || "Operazione non riuscita.")
      }
    } catch {
      setActionError("Operazione non riuscita.")
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = chatText.trim()
    if (!text) return

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) {
      router.replace("/login")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/trades/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, text }),
      })
      const data = await res.json()
      if (data.success) {
        setTrade(data.trade)
        setChatText("")
      } else {
        setActionError(data.message || "Impossibile inviare il messaggio.")
      }
    } catch {
      setActionError("Impossibile inviare il messaggio.")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Caricamento...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12">
        <div className="mx-auto w-full max-w-2xl text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Link href="/trades" className="mt-4 inline-block text-sm font-medium underline">
            Torna agli scambi
          </Link>
        </div>
      </div>
    )
  }

  if (!trade) return null

  const otherParty = isRecipient ? trade.fromUsername : trade.toUsername

  return (
    <div className="py-12">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/trades" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← Torna agli scambi
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Scambio con {otherParty || "utente"}
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {isRecipient ? "Proposta ricevuta" : "Proposta inviata"}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses(trade.status)}`}>
            {STATUS_LABELS[trade.status] || trade.status}
          </span>
        </div>

        {isRecipient && trade.offeredItemName && (
          <WishlistMatchBadge kind="trade" name={trade.offeredItemName} className="mt-6" />
        )}

        <div className="mt-6 flex items-center gap-4">
          <ItemCard label="Offerto" name={trade.offeredItemName} image={trade.offeredItemImage} />
          <span className="mt-6 text-2xl text-neutral-400">⇄</span>
          <ItemCard label="Richiesto" name={trade.requestedItemName} image={trade.requestedItemImage} />
        </div>

        {trade.message && (
          <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Messaggio</p>
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{trade.message}</p>
          </div>
        )}

        {trade.status === "accepted" && otherParty && (
          <ReviewPromptCard
            targetUsername={otherParty}
            type="trade"
            refId={trade._id}
            title="Recensisci lo scambio"
            pose="deal"
            className="mt-6"
          />
        )}

        {actionError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{actionError}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          {trade.status === "pending" && isRecipient && (
            <>
              <button
                onClick={() => handleAction("accept")}
                className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                Accetta
              </button>
              <button
                onClick={() => handleAction("reject")}
                className="rounded-lg border border-red-300 px-5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Rifiuta
              </button>
            </>
          )}
          {trade.status === "pending" && !isRecipient && (
            <button
              onClick={() => handleAction("reject")}
              className="rounded-lg border border-red-300 px-5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Annulla proposta
            </button>
          )}
          <button
            onClick={() => setShowChat((s) => !s)}
            className="rounded-lg border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            {showChat ? "Nascondi chat" : `Chatta (${trade.messages.length})`}
          </button>
          <ContactChatButton
            contextType="trade"
            contextId={trade._id}
            label="Chat scambio"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          />
        </div>

        {showChat && (
          <div className="mt-6 rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <div className="max-h-80 overflow-y-auto p-4">
              {trade.messages.length === 0 ? (
                <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                  Nessun messaggio. Inizia la conversazione.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {trade.messages.map((m, index) => {
                    const mine = m.senderId === userId
                    return (
                      <li key={m._id || index} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                            mine
                              ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900"
                              : "bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                          }`}
                        >
                          {!mine && (
                            <p className="mb-0.5 text-xs font-medium opacity-70">{m.senderUsername || "Utente"}</p>
                          )}
                          <p className="text-sm">{m.text}</p>
                          <p className={`mt-1 text-right text-[10px] ${mine ? "opacity-60" : "text-neutral-400"}`}>
                            {formatTime(m.createdAt)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                  <div ref={chatEndRef} />
                </ul>
              )}
            </div>
            <form
              onSubmit={handleSendMessage}
              className="flex gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800"
            >
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Scrivi un messaggio..."
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
              />
              <button
                type="submit"
                disabled={sending || !chatText.trim()}
                className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                Invia
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
