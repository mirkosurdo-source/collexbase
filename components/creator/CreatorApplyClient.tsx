"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const MIN_IG = 10000
const MIN_TK = 5000

interface StatusResponse {
  ok: boolean
  hasApplication: boolean
  status: "pending" | "approved" | "rejected" | null
  isCreator: boolean
  decisionNote: string
  submittedAt: string | null
}

const BENEFITS = [
  { title: "Guadagni soldi reali", body: "Commissioni fino al 10% per 6 mesi su ogni utente che inviti." },
  { title: "Dashboard Creator dedicata", body: "Monitora guadagni, inviti e commissioni in tempo reale." },
  { title: "Sconti esclusivi", body: "I tuoi follower ottengono vantaggi riservati sulla piattaforma." },
  { title: "Badge Creator Partner", body: "Un badge esclusivo che distingue il tuo profilo." },
  { title: "Link e QR personalizzati", body: "Un link referral dedicato e un QR code pronto da condividere." },
  { title: "Accesso anticipato", body: "Prova in anteprima le nuove funzioni di CollexBase." },
]

const REQUIREMENTS = [
  "10.000+ follower su Instagram",
  "oppure 5.000+ follower su TikTok",
  "Profilo CollexBase verificato",
  "Nessuna violazione di moderazione",
  "Attività coerente con collezionismo, gaming o hobby",
]

const STEPS = [
  { n: 1, title: "Registrati", body: "Crea il tuo account CollexBase (o accedi)." },
  { n: 2, title: "Compila la richiesta", body: "Inserisci i tuoi social e i follower." },
  { n: 3, title: "Attendi la valutazione", body: "Il nostro team esamina la tua candidatura." },
  { n: 4, title: "Inizia a guadagnare", body: "Se approvato, ricevi link, dashboard e commissioni." },
]

const FAQS = [
  { q: "Quanto posso guadagnare?", a: "Ottieni una commissione del 10% per 6 mesi su ogni utente che inviti e che attiva un piano." },
  { q: "Posso prelevare i guadagni?", a: "Sì, puoi richiedere un payout in euro direttamente dalla tua dashboard Creator." },
  { q: "Posso usare i guadagni sulla piattaforma?", a: "Sì, puoi spendere il saldo in funzioni premium oppure richiederne il prelievo." },
  { q: "Il link è diverso dal referral normale?", a: "Sì, ricevi un link creator dedicato /i/<codice> con commissioni in denaro reale." },
  { q: "Posso diventare creator senza requisiti?", a: "No, è necessario soddisfare i requisiti minimi di follower e community." },
]

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("token")
}

export default function CreatorApplyClient() {
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)

  // Form state.
  const [instagramUrl, setInstagramUrl] = useState("")
  const [tiktokUrl, setTiktokUrl] = useState("")
  const [igFollowers, setIgFollowers] = useState("")
  const [tkFollowers, setTkFollowers] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    const t = getToken()
    setToken(t)
    if (!t) {
      setLoadingStatus(false)
      return
    }
    fetch("/api/creator/application-status", { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((data: StatusResponse) => {
        if (data.ok) setStatus(data)
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError("")

    const ig = igFollowers ? Number.parseInt(igFollowers, 10) : 0
    const tk = tkFollowers ? Number.parseInt(tkFollowers, 10) : 0
    if (ig < MIN_IG && tk < MIN_TK) {
      setFormError(
        `Requisiti non soddisfatti: servono almeno ${MIN_IG.toLocaleString("it-IT")} follower Instagram o ${MIN_TK.toLocaleString("it-IT")} follower TikTok.`,
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/creator/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          instagramUrl,
          tiktokUrl,
          followerCountInstagram: ig,
          followerCountTikTok: tk,
          message,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setFormError(data.error || "Invio non riuscito.")
        return
      }
      // Refresh status from the server to drive the banner.
      const s = await fetch("/api/creator/application-status", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json())
      if (s.ok) setStatus(s)
    } catch {
      setFormError("Si è verificato un errore. Riprova.")
    } finally {
      setSubmitting(false)
    }
  }

  const alreadyHandled =
    status?.isCreator || status?.status === "pending" || status?.status === "approved"

  return (
    <div className="py-10">
      {/* HERO */}
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-block rounded-full bg-accent px-4 py-1 text-sm font-medium text-accent-foreground">
          Creator Partner Program
        </span>
        <h1 className="mt-5 text-balance text-4xl font-bold leading-tight md:text-5xl">
          Diventa Creator Partner di CollexBase
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          Guadagna soldi reali, ottieni vantaggi esclusivi per i tuoi follower e accedi a strumenti
          professionali per far crescere la tua community.
        </p>
        <div className="mt-7 flex justify-center">
          <a
            href="#application"
            className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Invia richiesta
          </a>
        </div>
      </section>

      {/* STATUS BANNER */}
      {!loadingStatus && status && (status.hasApplication || status.isCreator) && (
        <section className="mx-auto mt-10 max-w-3xl">
          <StatusBanner status={status} />
        </section>
      )}

      {/* BENEFITS */}
      <section className="mx-auto mt-16 max-w-5xl">
        <h2 className="text-center text-2xl font-bold">Vantaggi</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-card-foreground">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* REQUIREMENTS */}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-center text-2xl font-bold">Requisiti minimi</h2>
        <ul className="mt-8 space-y-3 rounded-xl border border-border bg-card p-6">
          {REQUIREMENTS.map((r) => (
            <li key={r} className="flex items-start gap-3 text-card-foreground">
              <span aria-hidden className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
              <span className="leading-relaxed">{r}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto mt-16 max-w-5xl">
        <h2 className="text-center text-2xl font-bold">Come funziona</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                {s.n}
              </div>
              <h3 className="mt-4 font-semibold text-card-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* APPLICATION FORM */}
      <section id="application" className="mx-auto mt-16 max-w-2xl scroll-mt-20">
        <h2 className="text-center text-2xl font-bold">Form richiesta</h2>

        {!token ? (
          <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
            <p className="leading-relaxed text-muted-foreground">
              Per inviare una richiesta devi prima accedere al tuo account CollexBase.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/login"
                className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Accedi
              </Link>
              <Link
                href="/register"
                className="rounded-lg border border-border px-5 py-2.5 font-medium text-foreground transition-colors hover:bg-accent"
              >
                Registrati
              </Link>
            </div>
          </div>
        ) : alreadyHandled ? (
          <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center">
            <p className="leading-relaxed text-muted-foreground">
              {status?.isCreator
                ? "Sei già un Creator Partner. Apri la tua dashboard per gestire guadagni e inviti."
                : "Hai già una richiesta in corso. Controlla lo stato qui sopra."}
            </p>
            {status?.isCreator && (
              <Link
                href="/creator"
                className="mt-5 inline-block rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Vai alla dashboard
              </Link>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-xl border border-border bg-card p-6">
            <Field label="Link Instagram">
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/iltuoprofilo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            <Field label="Link TikTok">
              <input
                type="url"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://tiktok.com/@iltuoprofilo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Follower Instagram">
                <input
                  type="number"
                  min={0}
                  value={igFollowers}
                  onChange={(e) => setIgFollowers(e.target.value)}
                  placeholder="es. 12000"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </Field>
              <Field label="Follower TikTok">
                <input
                  type="number"
                  min={0}
                  value={tkFollowers}
                  onChange={(e) => setTkFollowers(e.target.value)}
                  placeholder="es. 6000"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </Field>
            </div>
            <Field label="Messaggio motivazionale">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Raccontaci della tua community e perché vuoi diventare Creator Partner."
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>

            {formError && (
              <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Invio in corso..." : "Invia richiesta"}
            </button>
          </form>
        )}
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-center text-2xl font-bold">Domande frequenti</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-xl border border-border bg-card p-5">
              <summary className="cursor-pointer list-none font-medium text-card-foreground marker:hidden">
                {f.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto mt-16 max-w-3xl rounded-2xl border border-border bg-card p-10 text-center">
        <h2 className="text-balance text-2xl font-bold">Vuoi diventare Creator Partner?</h2>
        <p className="mx-auto mt-3 max-w-xl text-pretty leading-relaxed text-muted-foreground">
          Compila il modulo e inizia a guadagnare con CollexBase.
        </p>
        <a
          href="#application"
          className="mt-6 inline-block rounded-lg bg-primary px-8 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Invia richiesta
        </a>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function StatusBanner({ status }: { status: StatusResponse }) {
  if (status.isCreator) {
    return (
      <div className="rounded-xl border border-border bg-accent p-5 text-center text-accent-foreground">
        <p className="font-semibold">Sei un Creator Partner attivo</p>
        <p className="mt-1 text-sm">
          Gestisci guadagni e inviti dalla tua{" "}
          <Link href="/creator" className="underline">
            dashboard Creator
          </Link>
          .
        </p>
      </div>
    )
  }

  const map = {
    pending: {
      title: "Richiesta in valutazione",
      body: "Abbiamo ricevuto la tua candidatura. Ti avviseremo appena sarà esaminata.",
    },
    approved: {
      title: "Richiesta approvata!",
      body: "Complimenti, sei un Creator Partner. Apri la dashboard per iniziare.",
    },
    rejected: {
      title: "Richiesta respinta",
      body: status.decisionNote || "La tua richiesta non è stata approvata.",
    },
  } as const

  const info = status.status ? map[status.status] : null
  if (!info) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-center">
      <p className="font-semibold text-card-foreground">{info.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{info.body}</p>
    </div>
  )
}
