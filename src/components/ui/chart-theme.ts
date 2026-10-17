/**
 * Chart colours from design tokens. CSS variables work in SVG presentation
 * attributes, so these strings can go straight into Recharts props.
 * Rule: the user's series uses team ink; everything else is neutral zinc;
 * win/loss tokens mark positive/negative. No rainbow palettes.
 */
export const chartTheme = {
  /** The user's series. */
  ink: "rgb(var(--team-ink-rgb))",
  inkFill: "rgb(var(--team-ink-rgb) / 0.28)",
  /** Secondary / comparison series. */
  neutral: "#a1a1aa",
  neutralDim: "#71717a",
  win: "var(--win)",
  loss: "var(--loss)",
  grid: "#27272a",
  axis: "#71717a",
  tick: "#a1a1aa",
  tooltipBg: "#18181b",
  tooltipBorder: "#3f3f46",
} as const;

export const chartTick = { fill: chartTheme.tick, fontSize: 11 } as const;

export const chartTooltipStyle = {
  contentStyle: {
    background: chartTheme.tooltipBg,
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: 8,
  },
  labelStyle: { color: chartTheme.tick },
  itemStyle: { color: chartTheme.ink },
} as const;
