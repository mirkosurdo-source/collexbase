"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

type Datum = { category: string; value: number; count: number }

function formatEUR(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value)
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export default function CategoryPieChart({ data, height = 260 }: { data: Datum[]; height?: number }) {
  // Collapse the long tail into an "Altro" slice to keep the legend readable.
  const top = data.slice(0, 5)
  const rest = data.slice(5)
  const restValue = rest.reduce((s, d) => s + d.value, 0)
  const slices = restValue > 0 ? [...top, { category: "Altro", value: restValue, count: rest.length }] : top
  const total = slices.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div style={{ width: "100%", maxWidth: 240, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="category" innerRadius="55%" outerRadius="90%" paddingAngle={2}>
              {slices.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--background)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [formatEUR(Number(v)), "Valore"]}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-full flex-1 flex-col gap-2">
        {slices.map((s, i) => (
          <li key={s.category} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="truncate text-foreground">{s.category}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
