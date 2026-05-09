'use client'

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

import type { PlayerStatsPoint } from '@/types'

type ProfitTrendChartProps = {
  data: PlayerStatsPoint[]
}

export function ProfitTrendChart({ data }: ProfitTrendChartProps) {
  return (
    <div className="h-72 w-full rounded-lg border bg-card p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 20, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="sessionDate" />
          <YAxis />
          <Tooltip
            formatter={(value) =>
              `${typeof value === 'number' ? value.toLocaleString('ja-JP') : value} pt`
            }
          />
          <Line
            type="monotone"
            dataKey="cumulativeNetProfit"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
            name="累積純利益"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
