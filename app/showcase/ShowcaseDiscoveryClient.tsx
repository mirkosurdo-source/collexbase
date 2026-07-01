"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Settings } from "lucide-react"
import ShowcaseCard, { type ShowcaseSummary } from "@/components/showcase/ShowcaseCard"
import CollexSpark, { type SparkPose } from "@/components/collexspark/CollexSpark"

interface DiscoverResponse {
  success: boolean
  themes: string[]
  popular: ShowcaseSummary[]
  fresh: ShowcaseSummary[]
  byTheme: ShowcaseSummary[]
  recommended: ShowcaseSummary[]
  groupShowcases: ShowcaseSummary[]
  featured: ShowcaseSummary[]
}

function Section({ title, pose, showcases }: { title: string; pose: SparkPose; showcases: ShowcaseSummary[] }) {
  if (!showcases.length) return null
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <CollexSpark pose={pose} size="sm" still />
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {showcases.map((s) => (
          <ShowcaseCard key={s.userId} showcase={s} />
        ))}
      </div>
    </section>
  )
}

export default function ShowcaseDiscoveryClient() {
  const [authed, setAuthed] = useState(false)
  const [data, setData] = useState<DiscoverResponse | null>(null)
  const [theme, setTheme] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAuthed(!!localStorage.getItem("token"))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const params = new URLSearchParams()
      if (theme) params.set("theme", theme)
      const res = await fetch(`/api/showcase/discover?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const json = (await res.json()) as DiscoverResponse
      setData(json.success ? json : null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [theme])

  useEffect(() => {
    load()
  }, [load])

  const themes = data?.themes ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CollexSpark pose="trend" size="lg" still />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vetrine</h1>
            <p className="text-sm text-muted-foreground">
              Scopri le collezioni più belle, i pezzi rari e le vetrine tematiche della community.
            </p>
          </div>
        </div>
        {authed ? (
          <Link
            href="/showcase/me"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Settings width={16} height={16} />
            La mia vetrina
          </Link>
        ) : null}
      </header>

      {/* Theme filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTheme("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            theme === "" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Tutti i temi
        </button>
        {themes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              theme === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          Nessuna vetrina disponibile al momento.
        </div>
      ) : (
        <>
          {!theme && data.featured?.length ? (
            <section className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
              <div className="mb-3 flex items-center gap-2">
                <CollexSpark pose="trend" size="sm" still />
                <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Vetrine in evidenza</h2>
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                  Premium
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.featured.map((s) => (
                  <ShowcaseCard key={s.userId} showcase={s} />
                ))}
              </div>
            </section>
          ) : null}
          {theme ? (
            <Section title={`Tema: ${theme}`} pose="happy" showcases={data.byTheme} />
          ) : (
            <>
              <Section title="Consigliate per te" pose="trend" showcases={data.recommended} />
              <Section title="Dai tuoi gruppi" pose="happy" showcases={data.groupShowcases} />
              <Section title="Vetrine popolari" pose="deal" showcases={data.popular} />
              <Section title="Nuove vetrine" pose="happy" showcases={data.fresh} />
            </>
          )}
          {!data.popular.length && !data.fresh.length && !data.byTheme.length ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
              <p>Ancora nessuna vetrina pubblica.</p>
              {authed ? (
                <p className="mt-1 text-sm">
                  <Link href="/showcase/me" className="text-primary hover:underline">
                    Crea la tua vetrina
                  </Link>{" "}
                  e mostra la tua collezione al mondo.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
