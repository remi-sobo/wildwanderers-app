"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { WeightPoint } from "@/lib/data/wellness";

// Weight over time, styled to the DESIGN.md data-viz palette: forest line on
// a faint bark grid, amber dots, Fraunces numerals on the axes.
export function WeightChart({ data }: { data: WeightPoint[] }) {
  const values = data.map((d) => d.lb);
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="rgba(107,74,46,0.12)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#7a7264", fontFamily: "var(--font-sans)" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(107,74,46,0.18)" }}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 11, fill: "#7a7264", fontFamily: "var(--font-display)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            cursor={{ stroke: "rgba(107,74,46,0.25)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgba(42,33,24,0.12)",
              background: "#fdfbf5",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              color: "#2a2118",
              boxShadow: "0 8px 24px rgba(42,33,24,0.06)",
            }}
            labelStyle={{ color: "#6b4a2e", fontWeight: 600 }}
            formatter={(v: number) => [`${v} lb`, "Weight"]}
          />
          <Line
            type="monotone"
            dataKey="lb"
            stroke="var(--color-forest)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--color-amber)", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--color-amber-deep)", strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
