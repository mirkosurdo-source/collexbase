"use client"

import { useCallback, useEffect, useState } from "react"
import {
  SectionHeader,
  StatCard,
  Card,
  Toolbar,
  TextInput,
  Select,
  TableShell,
  Th,
  Td,
  EmptyRow,
  Pagination,
  ActionBtn,
  Spinner,
  StatusPill,
  fmtDate,
  fmtNum,
  adminGet,
  adminDelete,
} from "./shared"

interface ApiKeyRow {
  id: string
  owner: string
  label: string
  keyPrefix: string
  scopes: string[]
  active: boolean
  callCount: number
  analyticsCallCount: number
  rateLimitPerMin: number
  lastUsedAt: string | null
  createdAt: string
}

interface WebhookError {
  id: string
  owner: string
  url: string
  active: boolean
  failureStreak: number
  lastError: string
  disabledReason: string
  lastDeliveryAt: string | null
}

interface ApiResponse {
  success: boolean
  keys: ApiKeyRow[]
  total: number
  page: number
  pages: number
  stats: {
    totalKeys: number
    activeKeys: number
    totalCalls: number
    analyticsCalls: number
    totalWebhooks: number
    disabledWebhooks: number
  }
  webhookErrors: WebhookError[]
}

const STATUS_OPTIONS = [
  { value: "", label: "Tutte le chiavi" },
  { value: "active", label: "Attive" },
  { value: "revoked", label: "Revocate" },
]

export default function ApiSection() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (status) params.set("status", status)
      if (search.trim()) params.set("q", search.trim())
      const res = await adminGet<ApiResponse>(`/api/admin/api-keys?${params.toString()}`)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, status, search])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [status])

  async function revoke(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Revocare questa chiave API? L'azione è irreversibile.")) return
    setBusyId(id)
    try {
      await adminDelete(`/api/admin/api-keys?id=${encodeURIComponent(id)}`)
      await load()
    } catch {
      // surfaced by reload
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="API & Webhook"
        description="Monitoraggio delle chiavi API pubbliche, dell'utilizzo per sviluppatore e degli errori di consegna dei webhook. Revoca le chiavi che abusano dei limiti."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Chiavi attive" value={fmtNum(data?.stats.activeKeys ?? 0)} hint={`${fmtNum(data?.stats.totalKeys ?? 0)} totali`} />
        <StatCard label="Chiamate API" value={fmtNum(data?.stats.totalCalls ?? 0)} hint="Tutte le chiavi" />
        <StatCard label="Chiamate analytics" value={fmtNum(data?.stats.analyticsCalls ?? 0)} />
        <StatCard
          label="Webhook disattivati"
          value={fmtNum(data?.stats.disabledWebhooks ?? 0)}
          hint={`${fmtNum(data?.stats.totalWebhooks ?? 0)} totali`}
        />
      </div>

      <Toolbar>
        <TextInput value={search} onChange={setSearch} placeholder="Cerca per username…" />
        <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <ActionBtn variant="primary" onClick={() => void load()}>
          Aggiorna
        </ActionBtn>
      </Toolbar>

      {loading ? (
        <div className="py-16">
          <Spinner label="Caricamento chiavi API…" />
        </div>
      ) : (
        <>
          <TableShell
            head={
              <tr>
                <Th>Chiave</Th>
                <Th>Proprietario</Th>
                <Th>Scope</Th>
                <Th>Chiamate</Th>
                <Th>Rate/min</Th>
                <Th>Ultimo uso</Th>
                <Th>Stato</Th>
                <Th className="text-right">Azioni</Th>
              </tr>
            }
          >
            {!data || data.keys.length === 0 ? (
              <EmptyRow colSpan={8} text="Nessuna chiave API trovata." />
            ) : (
              data.keys.map((k) => (
                <tr key={k.id} className="align-top">
                  <Td>
                    <div className="flex flex-col gap-1">
                      <span className="text-foreground">{k.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">{k.keyPrefix}</span>
                    </div>
                  </Td>
                  <Td>{k.owner}</Td>
                  <Td>
                    <span className="text-xs text-muted-foreground">{k.scopes.length} scope</span>
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs">{fmtNum(k.callCount)}</span>
                      {k.analyticsCallCount > 0 ? (
                        <span className="text-xs text-muted-foreground">{fmtNum(k.analyticsCallCount)} analytics</span>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">{k.rateLimitPerMin}</span>
                  </Td>
                  <Td>{k.lastUsedAt ? fmtDate(k.lastUsedAt) : "—"}</Td>
                  <Td>
                    <StatusPill status={k.active ? "active" : "revoked"} />
                  </Td>
                  <Td className="text-right">
                    {k.active ? (
                      <ActionBtn variant="danger" onClick={() => void revoke(k.id)} disabled={busyId === k.id}>
                        Revoca
                      </ActionBtn>
                    ) : (
                      <span className="text-xs text-muted-foreground">Revocata</span>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </TableShell>

          {data && data.pages > 1 ? <Pagination page={data.page} pages={data.pages} onPage={setPage} /> : null}

          <Card>
            <h3 className="mb-3 text-sm font-medium text-foreground">Errori di consegna webhook</h3>
            {!data || data.webhookErrors.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nessun errore webhook recente.</p>
            ) : (
              <div className="space-y-3">
                {data.webhookErrors.map((w) => (
                  <div
                    key={w.id}
                    className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-mono text-xs text-foreground">{w.url}</span>
                      <span className="text-xs text-muted-foreground">
                        {w.owner} · {w.lastError || w.disabledReason || "Errore sconosciuto"}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                        {w.failureStreak} fallimenti
                      </span>
                      <StatusPill status={w.active ? "active" : "disabled"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
