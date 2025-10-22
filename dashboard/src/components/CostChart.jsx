import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

function CostChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis
          dataKey="timestamp"
          stroke="#666"
          style={{ fontSize: '0.875rem' }}
        />
        <YAxis
          stroke="#666"
          style={{ fontSize: '0.875rem' }}
          tickFormatter={(value) => `$${value.toFixed(2)}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1rem'
          }}
          formatter={(value) => `$${value.toFixed(4)}`}
        />
        <Legend
          wrapperStyle={{ fontSize: '0.875rem' }}
        />
        <Line
          type="monotone"
          dataKey="original"
          stroke="#ef4444"
          strokeWidth={2}
          name="Original Cost"
          dot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="optimized"
          stroke="#10b981"
          strokeWidth={2}
          name="Optimized Cost"
          dot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="saved"
          stroke="#667eea"
          strokeWidth={2}
          name="Savings"
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default CostChart;
