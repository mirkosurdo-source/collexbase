"use client"

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts"

export interface TrendPoint {
  label: string
  value: number
}

/** Compact price-trend sparkline for a single wishlist item (Blocco 24 §5). */
export default function WishlistPriceTrend({ data }: { data: TrendPoint[] }) {
  if (!data || data.length === 0) return null

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              color: "var(--popover-foreground)",
              fontSize: "0.75rem",
            }}
            formatter={(value) => [`€ ${Math.round(Number(value)).toLocaleString("it-IT")}`, "Prezzo"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--spark)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
