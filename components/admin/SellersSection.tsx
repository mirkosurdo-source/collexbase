"use client"

import { useState } from "react"
import {
  ActionBtn,
  Card,
  EmptyRow,
  fmtEUR,
  fmtNum,
  adminPost,
  SectionHeader,
  Select,
  Spinner,
  StatCard,
  StatusPill,
  TableShell,
  Td,
  Th,
  Toolbar,
  useAdminData,
} from "@/components/admin/shared"

interface SellerStripe {
  connected: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}

interface Seller {
  id: string
  userId: string
  username: string
  active: boolean
  commissionRate: number
  totalSales: number
  totalOrders: number
  totalCommission: number
  totalPayout: number
  rating: number
  ratingCount: number
  stripe: SellerStripe
  createdAt: string
}

interface ListResponse {
  success: boolean
  sellers: Seller[]
  totals: { totalSales: number; totalCommission: number; totalOrders: number }
}

function StripeState({ s }: { s: SellerStripe }) {
  if (!s.connected) return <span className="text-xs text-muted-foreground">Non collegato</span>
  if (s.chargesEnabled && s.payoutsEnabled)
    return <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Operativo</span>
  if (s.detailsSubmitted)
    return <span className="text-xs text-amber-600 dark:text-amber-400">In verifica</span>
  return <span className="text-xs text-amber-600 dark:text-amber-400">Onboarding</span>
}

export default function SellersSection() {
  const [status, setStatus] = useState("all")
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState("")
  const { data, loading, error, reload } = useAdminData<ListResponse>(
    `/api/admin/seller/list${status === "all" ? "" : `?status=${status}`}`,
    [status],
  )

  async function act(path: string, body: Record<string, unknown>, label: string) {
    setBusy(label)
    setFeedback("")
    try {
      const res = await adminPost<{ success: boolean; message?: string }>(path, body)
      setFeedback(res.success ? "Operazione completata." : res.message || "Errore.")
      if (res.success) await reload()
    } catch {
      setFeedback("Errore di connessione.")
    } finally {
      setBusy(null)
    }
  }

  async function editCommission(seller: Seller) {
    const input = window.prompt(
      `Commissione per ${seller.username} (percentuale, es. 10 = 10%)`,
      String(Math.round(seller.commissionRate * 100)),
    )
    if (input === null) return
    const pct = Number(input)
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) {
      setFeedback("Percentuale non valida (0–90).")
      return
    }
    await act("/api/admin/seller/commission", { userId: seller.userId, commissionRate: pct / 100 }, seller.id)
  }

  const sellers = data?.sellers || []
  const totals = data?.totals

  return (
    <div>
      <SectionHeader
        title="Venditori Pro"
        description="Gestisci la modalità Venditore Professionista, le commissioni e lo stato Stripe Connect."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Venditori" value={fmtNum(sellers.length)} />
        <StatCard label="Vendite totali" value={fmtEUR(totals?.totalSales || 0)} />
        <StatCard label="Commissioni" value={fmtEUR(totals?.totalCommission || 0)} />
        <StatCard label="Ordini" value={fmtNum(totals?.totalOrders || 0)} />
      </div>

      <Toolbar>
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Tutti" },
            { value: "active", label: "Attivi" },
            { value: "inactive", label: "Disattivati" },
          ]}
        />
        <ActionBtn onClick={reload}>Aggiorna</ActionBtn>
        {feedback && <span className="text-xs text-muted-foreground">{feedback}</span>}
      </Toolbar>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{error}</Card>
      ) : (
        <TableShell
          head={
            <>
              <Th>Venditore</Th>
              <Th>Stato</Th>
              <Th>Commissione</Th>
              <Th>Vendite</Th>
              <Th>Ordini</Th>
              <Th>Rating</Th>
              <Th>Stripe</Th>
              <Th className="text-right">Azioni</Th>
            </>
          }
        >
          {sellers.length === 0 ? (
            <EmptyRow colSpan={8} text="Nessun venditore." />
          ) : (
            sellers.map((s) => (
              <tr key={s.id}>
                <Td>
                  <span className="font-medium">{s.username}</span>
                </Td>
                <Td>
                  <StatusPill status={s.active ? "active" : "blocked"} />
                </Td>
                <Td>{Math.round(s.commissionRate * 100)}%</Td>
                <Td>{fmtEUR(s.totalSales)}</Td>
                <Td>{fmtNum(s.totalOrders)}</Td>
                <Td>{s.ratingCount > 0 ? `${s.rating.toFixed(1)} (${s.ratingCount})` : "—"}</Td>
                <Td>
                  <StripeState s={s.stripe} />
                </Td>
                <Td className="text-right">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {s.active ? (
                      <ActionBtn
                        variant="danger"
                        disabled={busy === s.id}
                        onClick={() => act("/api/admin/seller/deactivate", { userId: s.userId }, s.id)}
                      >
                        Disattiva
                      </ActionBtn>
                    ) : (
                      <ActionBtn
                        variant="primary"
                        disabled={busy === s.id}
                        onClick={() => act("/api/admin/seller/activate", { userId: s.userId }, s.id)}
                      >
                        Attiva
                      </ActionBtn>
                    )}
                    <ActionBtn disabled={busy === s.id} onClick={() => editCommission(s)}>
                      Commissione
                    </ActionBtn>
                    <ActionBtn
                      disabled={busy === s.id}
                      onClick={() => act("/api/admin/seller/reset-stripe", { userId: s.userId }, s.id)}
                    >
                      Reset Stripe
                    </ActionBtn>
                  </div>
                </Td>
              </tr>
            ))
          )}
        </TableShell>
      )}
    </div>
  )
}
