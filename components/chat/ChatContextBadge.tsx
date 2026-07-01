import { ArrowLeftRight, Store, Gavel, MessageCircle } from "lucide-react"
import type { ChatType } from "@/lib/chat-client"

const CONFIG: Record<ChatType, { label: string; icon: typeof MessageCircle; className: string }> = {
  private: { label: "Privata", icon: MessageCircle, className: "bg-secondary text-secondary-foreground" },
  trade: { label: "Scambio", icon: ArrowLeftRight, className: "bg-primary/10 text-primary" },
  marketplace: { label: "Annuncio", icon: Store, className: "bg-accent text-accent-foreground" },
  auction: { label: "Asta", icon: Gavel, className: "bg-primary/10 text-primary" },
}

export default function ChatContextBadge({ type, label }: { type: ChatType; label?: string }) {
  const cfg = CONFIG[type]
  const Icon = cfg.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
      title={label || cfg.label}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label || cfg.label}
    </span>
  )
}
