export const COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569"];

export function Stat({ value, label }) {
  return (
    <div className="stat">
      <b>{value}</b>
      {label}
    </div>
  );
}

function heat(v, vmax) {
  const t = Math.max(-1, Math.min(1, v / vmax));
  const lerp = (a, b, k) => Math.round(a + (b - a) * k);
  if (t < 0) {
    const k = -t;
    return `rgb(${lerp(255, 37, k)},${lerp(255, 99, k)},${lerp(255, 235, k)})`;
  }
  return `rgb(${lerp(255, 220, t)},${lerp(255, 38, t)},${lerp(255, 38, t)})`;
}

/* Generic heat-map: matrix[row][col]. Blue = low, white = 0, red = high. */
export function HeatGrid({ rowLabels, colLabels, matrix, vmax = 3, cellW = 12, cellH = 20,
  showValues = false, colColors = null, showColLabels = false }) {
  const left = 90;
  const stripH = colColors ? 14 : 0;
  const labelH = showColLabels ? 80 : 0;
  const top = stripH + labelH + 4;
  const width = left + cellW * colLabels.length + (showColLabels ? 60 : 10);
  const height = top + cellH * rowLabels.length + 4;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={height} style={{ fontSize: 11 }}>
        {colColors && colColors.map((c, j) => (
          <rect key={"s" + j} x={left + j * cellW} y={0} width={cellW} height={10} fill={c} />
        ))}
        {showColLabels && colLabels.map((l, j) => (
          <text key={"c" + j} transform={`translate(${left + j * cellW + cellW / 2},${stripH + labelH}) rotate(-60)`}>{l}</text>
        ))}
        {rowLabels.map((l, i) => (
          <text key={"r" + i} x={left - 6} y={top + i * cellH + cellH / 2 + 4} textAnchor="end">{l}</text>
        ))}
        {matrix.map((row, i) => row.map((v, j) => (
          <g key={i + "-" + j}>
            <rect x={left + j * cellW} y={top + i * cellH} width={cellW - 1} height={cellH - 1} fill={heat(v, vmax)}>
              <title>{`${rowLabels[i]} / ${colLabels[j]}: ${v}`}</title>
            </rect>
            {showValues && (
              <text x={left + j * cellW + cellW / 2} y={top + i * cellH + cellH / 2 + 4} textAnchor="middle" fontSize={10}>{v}</text>
            )}
          </g>
        )))}
      </svg>
      <div className="legend">
        <span>{-vmax}</span>
        <div className="legend-bar" />
        <span>+{vmax}</span>
      </div>
    </div>
  );
}

export function ConfusionMatrix({ labels, matrix }) {
  const max = Math.max(...matrix.flat(), 1);
  return (
    <table className="cm">
      <thead>
        <tr><th></th>{labels.map((l) => <th key={l}>Predicted {l}</th>)}</tr>
      </thead>
      <tbody>
        {matrix.map((row, i) => (
          <tr key={i}>
            <th>Actual {labels[i]}</th>
            {row.map((v, j) => (
              <td key={j} style={{ background: `rgba(67,56,202,${0.1 + 0.8 * v / max})`, color: v / max > 0.5 ? "#fff" : "#111" }}>{v}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
