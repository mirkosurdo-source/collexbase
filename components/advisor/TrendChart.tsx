"use client"

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts"
import type { TrendPoint } from "./types"

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun dato di tendenza disponibile.</p>
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              color: "var(--popover-foreground)",
              fontSize: "0.8rem",
            }}
            formatter={(value) => [`${Math.round(Number(value))}`, "Indice"]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((point, i) => (
              <Cell key={i} fill={point.value >= 0 ? "var(--spark)" : "var(--destructive)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
