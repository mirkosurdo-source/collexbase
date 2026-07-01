"use client"

import { useEffect, useState } from "react"
import KeysPanel from "./KeysPanel"
import WebhooksPanel from "./WebhooksPanel"
import DocsPanel from "./DocsPanel"
import PlaygroundPanel from "./PlaygroundPanel"

type Tab = "keys" | "webhooks" | "docs" | "playground"

const TABS: { id: Tab; label: string }[] = [
  { id: "keys", label: "API Keys" },
  { id: "webhooks", label: "Webhook" },
  { id: "docs", label: "Documentazione" },
  { id: "playground", label: "Playground" },
]

export default function DeveloperPortal() {
  const [tab, setTab] = useState<Tab>("keys")
  const [token, setToken] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null
    setToken(t)
    setChecked(true)
  }, [])

  if (checked && !token) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Developer Portal</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Accedi al tuo account per gestire API key e webhook.
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Accedi
        </a>
      </div>
    )
  }

  return (
    <div className="py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-balance text-neutral-900 dark:text-neutral-100">
          Developer Portal
        </h1>
        <p className="mt-1 text-pretty text-neutral-600 dark:text-neutral-400">
          Crea API key, configura webhook e integra CollexBase nei tuoi strumenti.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900" aria-label="Sezioni developer">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section>
        {tab === "keys" && <KeysPanel token={token} />}
        {tab === "webhooks" && <WebhooksPanel token={token} />}
        {tab === "docs" && <DocsPanel />}
        {tab === "playground" && <PlaygroundPanel />}
      </section>
    </div>
  )
}
