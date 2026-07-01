"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/* -------------------------------------------------------------------------- */
/* Fetch helpers                                                               */
/* -------------------------------------------------------------------------- */

export function adminToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null
}

export async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${adminToken() || ""}` } })
  return res.json()
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken() || ""}` },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function adminDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken() || ""}` },
  })
  return res.json()
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken() || ""}` },
    body: JSON.stringify(body),
  })
  return res.json()
}

/** Loads data from an admin endpoint, re-running when `deps` change. */
export function useAdminData<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const json = await adminGet<{ success: boolean; message?: string } & T>(url)
      if (!json.success) setError(json.message || "Errore di caricamento.")
      setData(json as T)
    } catch {
      setError("Errore di connessione.")
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload }
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

export function fmtEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0)
}

export function fmtNum(value: number): string {
  return new Intl.NumberFormat("it-IT").format(value || 0)
}

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

export function Spinner({ label = "Caricamento…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
      {label}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold tracking-tight text-foreground text-balance">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>}
    </div>
  )
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>{children}</div>
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    held: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    awaiting_payment: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    disputed: "bg-red-500/10 text-red-600 dark:text-red-400",
    blocked: "bg-red-500/10 text-red-600 dark:text-red-400",
    cancelled: "bg-muted text-muted-foreground",
    rejected: "bg-muted text-muted-foreground",
    closed: "bg-muted text-muted-foreground",
    released: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    sold: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    refunded: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  )
}

export function PlanPill({ plan }: { plan: string }) {
  const map: Record<string, string> = {
    Base: "bg-muted text-muted-foreground",
    Gold: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Premium: "bg-primary/10 text-primary",
  }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[plan] || "bg-muted"}`}>{plan}</span>
}

export function ActionBtn({
  children,
  onClick,
  variant = "default",
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  variant?: "default" | "primary" | "danger"
  disabled?: boolean
}) {
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : variant === "danger"
        ? "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
        : "border border-border bg-background text-foreground hover:bg-accent"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  )
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
    />
  )
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function TableShell({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{head}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  )
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-medium ${className}`}>{children}</th>
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle text-foreground ${className}`}>{children}</td>
}

export function EmptyRow({ colSpan, text = "Nessun risultato." }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">
        {text}
      </td>
    </tr>
  )
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm">
      <ActionBtn onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>
        Precedente
      </ActionBtn>
      <span className="text-muted-foreground">
        {page} / {pages}
      </span>
      <ActionBtn onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}>
        Successiva
      </ActionBtn>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Charts                                                                      */
/* -------------------------------------------------------------------------- */

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
}

export function AdminAreaChart({ data, height = 240 }: { data: { label: string; value: number }[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="adminFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={20} />
          <YAxis width={36} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} fill="url(#adminFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const BAR_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export function AdminBarChart({ data, height = 240 }: { data: { category: string; value: number }[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="category" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis width={36} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
