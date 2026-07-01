"use client"

import { useState } from "react"
import {
  useAdminData,
  adminPatch,
  Spinner,
  StatCard,
  SectionHeader,
  Toolbar,
  TextInput,
  Select,
  TableShell,
  Th,
  Td,
  EmptyRow,
  Pagination,
  ActionBtn,
  fmtNum,
  fmtDate,
} from "@/components/admin/shared"

interface BoostRow {
  id: string
  username: string
  targetType: "marketplace" | "auction" | "trade" | "showcase"
  targetId: string
  tier: string
  label: string
  coinsSpent: number
  visibilityPct: number
  status: "active" | "expired" | "disabled"
  endsAt: string
  createdAt: string
}

interface BoostResponse {
  success: boolean
  boosts: BoostRow[]
  total: number
  page: number
  pages: number
  stats: { total: number; coins: number; active: number; topType: string }
}

const TYPE_LABEL: Record<string, string> = {
  marketplace: "Annuncio",
  auction: "Asta",
  trade: "Scambio",
  showcase: "Vetrina",
}

export default function BoostSection() {
  const [q, setQ] = useState("")
  const [targetType, setTargetType] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState("")

  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (targetType) params.set("targetType", targetType)
  if (status) params.set("status", status)
  params.set("page", String(page))

  const { data, loading, error, reload } = useAdminData<BoostResponse>(`/api/admin/boost?${params.toString()}`, [
    q,
    targetType,
    status,
    page,
  ])

  async function setDisabled(id: string, disabled: boolean) {
    setBusy(id)
    await adminPatch(`/api/admin/boost`, { id, disabled }).catch(() => {})
    setBusy("")
    reload()
  }

  const stats = data?.stats

  return (
    <div>
      <SectionHeader title="Boost Premium" description="Monitora e modera gli annunci in evidenza acquistati con CollexCoins." />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Boost totali" value={fmtNum(stats?.total ?? 0)} />
        <StatCard label="Attivi" value={fmtNum(stats?.active ?? 0)} />
        <StatCard label="Coins spesi" value={fmtNum(stats?.coins ?? 0)} />
        <StatCard label="Tipo più diffuso" value={TYPE_LABEL[stats?.topType ?? ""] ?? "—"} />
      </div>

      <Toolbar>
        <TextInput
          value={q}
          onChange={(v) => {
            setPage(1)
            setQ(v)
          }}
          placeholder="Cerca per ID target…"
        />
        <Select
          value={targetType}
          onChange={(v) => {
            setPage(1)
            setTargetType(v)
          }}
          options={[
            { value: "", label: "Tutti i tipi" },
            { value: "marketplace", label: "Annunci" },
            { value: "auction", label: "Aste" },
            { value: "trade", label: "Scambi" },
            { value: "showcase", label: "Vetrine" },
          ]}
        />
        <Select
          value={status}
          onChange={(v) => {
            setPage(1)
            setStatus(v)
          }}
          options={[
            { value: "", label: "Tutti gli stati" },
            { value: "active", label: "Attivi" },
            { value: "expired", label: "Scaduti" },
            { value: "disabled", label: "Disattivati" },
          ]}
        />
      </Toolbar>

      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-500">{error}</p>
      ) : (
        <>
          <TableShell
            head={
              <>
                <Th>Utente</Th>
                <Th>Tipo</Th>
                <Th>Livello</Th>
                <Th className="text-right">Coins</Th>
                <Th className="text-right">Visibilità</Th>
                <Th>Stato</Th>
                <Th>Scadenza</Th>
                <Th className="text-right">Azioni</Th>
              </>
            }
          >
            {data && data.boosts.length > 0 ? (
              data.boosts.map((b) => (
                <tr key={b.id}>
                  <Td>
                    <a href={`/profile/${b.username}`} className="text-primary hover:underline">
                      @{b.username}
                    </a>
                  </Td>
                  <Td>{TYPE_LABEL[b.targetType] ?? b.targetType}</Td>
                  <Td className="font-medium">{b.label}</Td>
                  <Td className="text-right">{fmtNum(b.coinsSpent)}</Td>
                  <Td className="text-right">+{b.visibilityPct}%</Td>
                  <Td>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        b.status === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : b.status === "expired"
                            ? "bg-muted text-muted-foreground"
                            : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {b.status === "active" ? "attivo" : b.status === "expired" ? "scaduto" : "disattivato"}
                    </span>
                  </Td>
                  <Td>{fmtDate(b.endsAt)}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {b.status === "disabled" ? (
                        <ActionBtn onClick={() => setDisabled(b.id, false)} disabled={busy === b.id}>
                          Riattiva
                        </ActionBtn>
                      ) : (
                        <ActionBtn
                          variant="danger"
                          onClick={() => setDisabled(b.id, true)}
                          disabled={busy === b.id || b.status === "expired"}
                        >
                          Disattiva
                        </ActionBtn>
                      )}
                    </div>
                  </Td>
                </tr>
              ))
            ) : (
              <EmptyRow colSpan={8} />
            )}
          </TableShell>
          <Pagination page={data?.page ?? 1} pages={data?.pages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  )
}
