import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import "./Analysis.css";

const PIE_COLORS = ["#4caf82", "#888", "#e24b4a"];

export default function Analysis({ data, targetUser }) {
  const [filter, setFilter] = useState("all");

  if (!data) {
    return (
      <div className="analysis-empty">
        Enter a Chess.com username above and click <strong>Analyze</strong> to see their full opening repertoire here.
      </div>
    );
  }

  const { total_games, opening_stats } = data;

  const totals = opening_stats.reduce(
    (acc, o) => { acc.wins += o.wins; acc.draws += o.draws; acc.losses += o.losses; return acc; },
    { wins: 0, draws: 0, losses: 0 }
  );

  const pieData = [
    { name: "Wins", value: totals.wins },
    { name: "Draws", value: totals.draws },
    { name: "Losses", value: totals.losses },
  ];

  const overallWinRate = total_games > 0 ? Math.round((totals.wins / total_games) * 100) : 0;

  const barData = opening_stats.slice(0, 8).map(o => ({
    name: o.opening.length > 20 ? o.opening.slice(0, 20) + "…" : o.opening,
    "Win %": o.win_rate,
  }));

  const filtered = opening_stats.filter(o => {
    if (filter === "strong") return o.win_rate >= 55 && o.total >= 2;
    if (filter === "weak") return o.win_rate < 40 && o.total >= 2;
    return true;
  });

  function winColor(rate) {
    if (rate >= 55) return "#4caf82";
    if (rate < 40) return "#e24b4a";
    return "#c8b86a";
  }

  return (
    <div className="analysis">
      <div className="analysis-title">📊 {targetUser} — {total_games} games analyzed</div>

      <div className="stat-cards">
        <StatCard label="Total games" value={total_games} />
        <StatCard label="Win rate" value={`${overallWinRate}%`} color="#4caf82" />
        <StatCard label="Wins" value={totals.wins} color="#4caf82" />
        <StatCard label="Draws" value={totals.draws} color="#888" />
        <StatCard label="Losses" value={totals.losses} color="#e24b4a" />
        <StatCard label="Openings played" value={opening_stats.length} />
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Overall results</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#18181f", border: "1px solid #333", borderRadius: 6, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card chart-wide">
          <div className="chart-title">Win rate — top 8 openings</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "#666", fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#aaa", fontSize: 10 }} />
              <Tooltip formatter={v => `${v}%`} contentStyle={{ background: "#18181f", border: "1px solid #333", borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="Win %" fill="#c8b86a" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="openings-section">
        <div className="openings-header">
          <div className="chart-title" style={{ marginBottom: 0 }}>Full opening repertoire</div>
          <div className="filter-tabs">
            <button className={filter === "all" ? "ftab on" : "ftab"} onClick={() => setFilter("all")}>
              All ({opening_stats.length})
            </button>
            <button className={filter === "strong" ? "ftab on" : "ftab"} onClick={() => setFilter("strong")}>
              💪 Strong ≥55% ({opening_stats.filter(o => o.win_rate >= 55 && o.total >= 2).length})
            </button>
            <button className={filter === "weak" ? "ftab on" : "ftab"} onClick={() => setFilter("weak")}>
              ⚠ Weak &lt;40% ({opening_stats.filter(o => o.win_rate < 40 && o.total >= 2).length})
            </button>
          </div>
        </div>

        <div className="openings-legend">
          <span className="legend-item"><span className="ldot" style={{background:"#4caf82"}}></span>Strong (≥55%)</span>
          <span className="legend-item"><span className="ldot" style={{background:"#c8b86a"}}></span>Average (40–54%)</span>
          <span className="legend-item"><span className="ldot" style={{background:"#e24b4a"}}></span>Weak (&lt;40%) — exploit these</span>
        </div>

        <table className="openings-table">
          <thead>
            <tr><th>#</th><th>Opening</th><th>Games</th><th>W</th><th>D</th><th>L</th><th>Win %</th><th>Trend</th></tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => (
              <tr key={i} className={o.win_rate < 40 && o.total >= 2 ? "weak-row" : ""}>
                <td style={{ color: "#444", fontSize: 11 }}>{i + 1}</td>
                <td>{o.opening}</td>
                <td>{o.total}</td>
                <td style={{ color: "#4caf82" }}>{o.wins}</td>
                <td style={{ color: "#666" }}>{o.draws}</td>
                <td style={{ color: "#e24b4a" }}>{o.losses}</td>
                <td><span style={{ color: winColor(o.win_rate), fontWeight: 500 }}>{o.win_rate}%</span></td>
                <td>
                  <div className="win-bar-wrap">
                    <div className="win-bar" style={{ width: `${o.win_rate}%`, background: winColor(o.win_rate) }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: "20px", textAlign: "center", color: "#555", fontSize: 13 }}>
            No openings match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}