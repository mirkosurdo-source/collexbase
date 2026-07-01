"use client"

import Link from "next/link"
import ThemeSwitcher from "@/components/ThemeSwitcher"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import NotificationBell from "@/components/NotificationBell"
import MessagesBell from "@/components/MessagesBell"
import AdminNavLink from "@/components/AdminNavLink"
import AuthButton from "@/components/AuthButton"
import { useTranslation } from "@/lib/i18n/LanguageProvider"

// href + translation key. Labels are resolved at render time from the active locale.
const links = [
  { tKey: "nav.home", href: "/" },
  { tKey: "nav.market", href: "/market" },
  { tKey: "nav.offers", href: "/market/offers" },
  { tKey: "nav.wishlist", href: "/wishlist" },
  { tKey: "nav.following", href: "/following" },
  { tKey: "nav.trades", href: "/trades" },
  { tKey: "nav.auctions", href: "/auctions" },
  { tKey: "nav.scanner", href: "/scanner" },
  { tKey: "nav.collection", href: "/collections" },
  { tKey: "nav.advisor", href: "/advisor" },
  { tKey: "nav.analytics", href: "/analytics" },
  { tKey: "nav.community", href: "/community" },
  { tKey: "nav.groups", href: "/groups" },
  { tKey: "nav.showcase", href: "/showcase" },
  { tKey: "nav.blog", href: "/community/blog" },
  { tKey: "nav.messages", href: "/messages" },
  { tKey: "nav.chat", href: "/chat" },
  { tKey: "nav.wallet", href: "/wallet" },
  { tKey: "nav.store", href: "/coins/store" },
  { tKey: "nav.payments", href: "/payments" },
  { tKey: "nav.subscription", href: "/subscription" },
  { tKey: "nav.profile", href: "/profile" },
  { tKey: "nav.referral", href: "/referral" },
  { tKey: "nav.creator", href: "/creator" },
  { tKey: "nav.creatorApply", href: "/creator-apply" },
  { tKey: "nav.developer", href: "/developer" },
  { tKey: "nav.download", href: "/download" },
]

export default function Navbar() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
          CollexBase
        </Link>

        <ul className="flex flex-wrap items-center gap-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {t(link.tKey)}
              </Link>
            </li>
          ))}
          <AdminNavLink />
        </ul>

        <div className="flex items-center gap-1">
          <MessagesBell />
          <NotificationBell />
          <LanguageSwitcher />
          <ThemeSwitcher />
          <AuthButton />
        </div>
      </nav>
    </header>
  )
}
