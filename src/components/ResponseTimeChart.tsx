
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

type DataPoint = {
  time: string;
  responseTime: number;
};

type Props = {
  data: DataPoint[];
};

export default function ResponseTimeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        No response-time data available.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid
            stroke="#3f3f46"
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="time"
            tickFormatter={(value: string) =>
              value.slice(11, 16)
            }
            stroke="#a1a1aa"
          />

          <YAxis
            stroke="#a1a1aa"
            unit="ms"
          />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="responseTime"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Response Time (ms)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
