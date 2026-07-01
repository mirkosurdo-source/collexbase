"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Spinner, adminGet } from "./shared"

const NAV: { href: string; label: string }[] = [
  { href: "/admin/dashboard", label: "Panoramica" },
  { href: "/admin/users", label: "Utenti" },
  { href: "/admin/reputation", label: "Reputazione" },
  { href: "/admin/reviews", label: "Recensioni" },
  { href: "/admin/moderation", label: "Moderazione" },
  { href: "/admin/api", label: "API & Webhook" },
  { href: "/admin/creator", label: "Creator Partner" },
  { href: "/admin/creator/applications", label: "Richieste Creator" },
  { href: "/admin/creator/payouts", label: "Payout Creator" },
  { href: "/admin/subscriptions", label: "Abbonamenti" },
  { href: "/admin/coins", label: "Collex Coin" },
  { href: "/admin/coins-store", label: "Store Coins" },
  { href: "/admin/payments", label: "Pagamenti" },
  { href: "/admin/marketplace", label: "Marketplace" },
  { href: "/admin/sellers", label: "Venditori Pro" },
  { href: "/admin/trades", label: "Scambi" },
  { href: "/admin/auctions", label: "Aste" },
  { href: "/admin/wishlist", label: "Wishlist" },
  { href: "/admin/community", label: "Community" },
  { href: "/admin/groups", label: "Gruppi" },
  { href: "/admin/showcase", label: "Vetrine" },
  { href: "/admin/boost", label: "Boost" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/chat", label: "Chat" },
  { href: "/admin/notifications", label: "Notifiche" },
]

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authState, setAuthState] = useState<"checking" | "ok" | "denied">("checking")

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("token")) {
      router.replace("/login")
      return
    }
    adminGet<{ admin?: boolean }>("/api/admin/check")
      .then((res) => setAuthState(res.admin ? "ok" : "denied"))
      .catch(() => setAuthState("denied"))
  }, [router])

  if (authState === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Verifica accesso amministratore…" />
      </div>
    )
  }

  if (authState === "denied") {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Accesso riservato</h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Questa area è riservata agli amministratori della piattaforma. Se ritieni si tratti di un errore, contatta un altro amministratore.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Torna alla home
        </button>
      </div>
    )
  }

  const current = NAV.find((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
  const currentLabel = current?.label ?? "Panoramica"

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:px-6">
      <aside className="lg:w-56 lg:shrink-0">
        <div className="mb-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Amministrazione</h1>
          <p className="text-xs text-muted-foreground">Pannello di controllo CollexBase</p>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/admin/dashboard" className="hover:text-foreground">
            Admin
          </Link>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">{currentLabel}</span>
        </nav>
        {children}
      </main>
    </div>
  )
}
