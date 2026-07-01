"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"

export type LiveChatMessage = {
  id: string
  userId: string
  username: string
  message: string
  system: boolean
  createdAt: string | null
}

/**
 * Shared live chat panel for auctions and trades. Auto-scrolls to the newest
 * message, guards CJK IME composition on Enter, and surfaces moderation errors.
 */
export default function LiveChat({
  messages,
  currentUserId,
  onSend,
  disabled = false,
  error = "",
  className = "",
}: {
  messages: LiveChatMessage[]
  currentUserId: string
  onSend: (text: string) => Promise<void> | void
  disabled?: boolean
  error?: string
  className?: string
}) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length])

  async function submit() {
    const value = text.trim()
    if (!value || sending || disabled) return
    setSending(true)
    try {
      await onSend(value)
      setText("")
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    void submit()
  }

  return (
    <div className={`flex flex-col rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 ${className}`}>
      <div className="border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Chat live</h3>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ minHeight: "12rem", maxHeight: "22rem" }}>
        {messages.length === 0 ? (
          <p className="text-sm text-neutral-400">Nessun messaggio.</p>
        ) : (
          messages.map((m) =>
            m.system ? (
              <p key={m.id} className="text-center text-xs italic text-neutral-400">
                {m.message}
              </p>
            ) : (
              <div key={m.id} className={`flex flex-col ${m.userId === currentUserId ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${
                    m.userId === currentUserId
                      ? "bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900"
                      : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                  }`}
                >
                  {m.userId !== currentUserId && (
                    <span className="mb-0.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {m.username || "Utente"}
                    </span>
                  )}
                  <span className="break-words">{m.message}</span>
                </div>
              </div>
            ),
          )
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
        {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled || sending}
            placeholder={disabled ? "Chat non disponibile" : "Scrivi un messaggio..."}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
          <button
            type="button"
            onClick={submit}
            disabled={disabled || sending || !text.trim()}
            className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Invia
          </button>
        </div>
      </div>
    </div>
  )
}
