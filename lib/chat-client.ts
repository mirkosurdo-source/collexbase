"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type ChatType = "private" | "trade" | "marketplace" | "auction"

export interface ChatAttachment {
  url: string
  name?: string
  contentType?: string
  size?: number
}

export interface ChatMessageDTO {
  id: string
  threadId: string
  senderId: string
  senderUsername: string
  text: string | null
  attachments: ChatAttachment[]
  readBy: string[]
  deleted: boolean
  createdAt: string
}

export interface ChatUserDTO {
  id: string
  username: string
  avatar: string
}

export interface ChatThreadDTO {
  id: string
  type: ChatType
  participants: string[]
  contextId: string | null
  contextLabel: string
  lastMessageText: string
  lastMessageAt: string | null
  lastSenderId: string
  status: "active" | "suspended"
  unreadCount?: number
  otherUser?: ChatUserDTO | null
  createdAt: string
  updatedAt: string
}

function token(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem("token") || ""
}

/** Authenticated JSON fetch helper for the chat API. */
export async function chatFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token()}`,
      ...(init?.headers || {}),
    },
  })
  return (await res.json()) as T
}

/** Uploads an attachment via multipart form data. */
export async function uploadAttachment(file: File, threadId?: string) {
  const form = new FormData()
  form.append("file", file)
  if (threadId) form.append("threadId", threadId)
  const res = await fetch("/api/chat/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}` },
    body: form,
  })
  return (await res.json()) as { success: boolean; message?: string; attachment?: ChatAttachment }
}

/**
 * Generic polling hook. Calls `fn` immediately and then every `intervalMs`,
 * pausing while the tab is hidden to save resources. The documented WebSocket
 * fallback transport.
 */
export function usePolling(fn: () => void | Promise<void>, intervalMs = 4000, deps: unknown[] = []) {
  const saved = useRef(fn)
  saved.current = fn

  useEffect(() => {
    let active = true
    const tick = () => {
      if (active && document.visibilityState === "visible") void saved.current()
    }
    tick()
    const id = setInterval(tick, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      active = false
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps])
}

/** Negotiates the real-time transport (websocket gateway or polling). */
export function useRealtimeTransport() {
  const [transport, setTransport] = useState<"connecting" | "websocket" | "polling">("connecting")
  useEffect(() => {
    let cancelled = false
    chatFetch<{ success: boolean; transport?: string }>("/api/chat/ws")
      .then((res) => {
        if (cancelled) return
        setTransport(res.transport === "websocket" ? "websocket" : "polling")
      })
      .catch(() => !cancelled && setTransport("polling"))
    return () => {
      cancelled = true
    }
  }, [])
  return transport
}

export function formatTime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
}

export const CONTEXT_LABELS: Record<ChatType, string> = {
  private: "Privata",
  trade: "Scambio",
  marketplace: "Annuncio",
  auction: "Asta",
}
