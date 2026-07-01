"use client"

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import type { ScanResult } from "./types"

/**
 * Blocco 40 — full result view: identification, grading radar, defect bars,
 * authenticity and PSA-tier market value with a price trend chart.
 */
export default function ScanResultView({
  result,
  images,
}: {
  result: ScanResult
  images: string[]
}) {
  const { cardIdentified, grading, centering, defects, authenticity, marketValue, notes } = result

  return (
    <div className="flex flex-col gap-6">
      <IdentificationCard card={cardIdentified} image={images[0]} />
      <GradingCard grading={grading} centering={centering} />
      <DefectsCard defects={defects} />
      <AuthenticityCard authenticity={authenticity} />
      <MarketValueCard marketValue={marketValue} />
      {notes ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold text-card-foreground">Note del perito</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{notes}</p>
        </div>
      ) : null}
    </div>
  )
}

const eur = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0)

function gradeColor(score: number): string {
  if (score >= 9) return "text-primary"
  if (score >= 7) return "text-foreground"
  return "text-destructive"
}

/* -------------------------------------------------------------------------- */

function IdentificationCard({
  card,
  image,
}: {
  card: ScanResult["cardIdentified"]
  image?: string
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Identificazione carta
      </h3>
      <div className="flex gap-4">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image || "/placeholder.svg"}
            alt={card.name || "Carta"}
            className="h-32 w-24 shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Field label="Nome" value={card.name || "—"} />
          <Field label="Set" value={card.set || "—"} />
          <Field label="Numero" value={card.number || "—"} />
          <Field label="Anno" value={card.year ? String(card.year) : "—"} />
          <Field label="Variante" value={card.variant || "—"} />
          <Field label="Match" value={`${card.imageMatchConfidence}%`} />
        </dl>
      </div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-card-foreground">{value}</dd>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function GradingCard({
  grading,
  centering,
}: {
  grading: ScanResult["grading"]
  centering: ScanResult["centering"]
}) {
  const radarData = [
    { axis: "Centratura", value: grading.centering },
    { axis: "Angoli", value: grading.corners },
    { axis: "Bordi", value: grading.edges },
    { axis: "Superficie", value: grading.surface },
  ]

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Grading</h3>
        <div className="text-right">
          <span className={`text-3xl font-bold ${gradeColor(grading.overall)}`}>
            {grading.overall.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">/10</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} />
              <Radar
                dataKey="value"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col justify-center gap-3">
          <SubScore label="Centratura" value={grading.centering} />
          <SubScore label="Angoli" value={grading.corners} />
          <SubScore label="Bordi" value={grading.edges} />
          <SubScore label="Superficie" value={grading.surface} />
          <p className="mt-1 text-xs text-muted-foreground">
            Centratura {centering.percent}% · bordi {centering.left}/{centering.right} ·{" "}
            {centering.top}/{centering.bottom} (dev. {centering.deviation}%)
          </p>
        </div>
      </div>
    </section>
  )
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-card-foreground">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${(value / 10) * 100}%` }} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function DefectsCard({ defects }: { defects: ScanResult["defects"] }) {
  const rows: { label: string; value: number }[] = [
    { label: "Whitening", value: defects.whitening },
    { label: "Graffi", value: defects.scratches },
    { label: "Ammaccature", value: defects.dents },
    { label: "Edge wear", value: defects.edgeWear },
    { label: "Holo scratches", value: defects.holoScratches },
    { label: "Print lines", value: defects.printLines },
  ]
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Difetti rilevati</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium text-card-foreground">{Math.round(r.value)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${r.value >= 50 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.min(100, r.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Intensità più alta = difetto più marcato.</p>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function AuthenticityCard({ authenticity }: { authenticity: ScanResult["authenticity"] }) {
  const items: { label: string; value: number }[] = [
    { label: "Pattern holo", value: authenticity.holoPattern },
    { label: "Pattern stampa", value: authenticity.printPattern },
    { label: "Font", value: authenticity.fontMatch },
    { label: "Bordi/colori", value: authenticity.borderMatch },
  ]
  const score = authenticity.authenticityScore
  const verdict = score >= 80 ? "Autentica" : score >= 50 ? "Da verificare" : "Sospetta"
  const verdictClass =
    score >= 80 ? "text-primary" : score >= 50 ? "text-foreground" : "text-destructive"

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Autenticità</h3>
        <span className={`text-sm font-semibold ${verdictClass}`}>
          {verdict} · {score}%
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{it.label}</span>
            <span className="font-medium text-card-foreground">{Math.round(it.value)}%</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function MarketValueCard({ marketValue }: { marketValue: ScanResult["marketValue"] }) {
  const tiers = [
    { label: "Raw", value: marketValue.raw },
    { label: "PSA 8", value: marketValue.grade8 },
    { label: "PSA 9", value: marketValue.grade9 },
    { label: "PSA 10", value: marketValue.grade10 },
  ]
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Valore di mercato</h3>
        <div className="text-right">
          <span className="text-2xl font-bold text-card-foreground">{eur(marketValue.graded)}</span>
          <span className="ml-1 text-xs text-muted-foreground">stimato (graded)</span>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiers.map((t) => (
          <div key={t.label} className="rounded-lg bg-muted/50 p-3 text-center">
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className="text-base font-semibold text-card-foreground">{eur(t.value)}</div>
          </div>
        ))}
      </div>

      {marketValue.history.length > 0 ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={marketValue.history}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip
                formatter={(v: unknown) => eur(Number(v) || 0)}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  color: "var(--color-card-foreground)",
                }}
              />
              <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  )
}
