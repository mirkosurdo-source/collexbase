"use client"

import Link from "next/link"
import { MessageCircle } from "lucide-react"

type Props = {
  contextType: "trade" | "listing" | "auction"
  contextId: string
  label?: string
  className?: string
}

/**
 * Drop-in entry point that links to the contextual chat for a given
 * trade / listing / auction. The thread itself is created lazily on the
 * destination page, so this stays a cheap, side-effect-free link.
 */
export default function ContactChatButton({ contextType, contextId, label = "Apri chat", className }: Props) {
  return (
    <Link
      href={`/chat/c/${contextType}/${contextId}`}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      }
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  )
}
