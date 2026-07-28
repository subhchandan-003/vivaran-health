// Minimal hand-rolled SVG charts — no charting library dependency, consistent
// with the rest of this app's "vendor nothing you don't have to" approach.
// Follows the house dataviz rules: one hue for magnitude (never a rainbow for
// a single series), thin/rounded marks, recessive axes, a hover tooltip per
// mark, and a table-equivalent for anyone who can't use the hover layer.
import { escapeHtml } from "./dom.js";

const TEAL = "#2f9e8f";
const AXIS = "#e3e1da";
const AXIS_TEXT = "#6b7685";

function niceMax(value) {
  if (value <= 0) return 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// Vertical bar chart — one measure over ordered categories (e.g. visits per month).
export function renderBarChart({ labels, values, height = 220 }) {
  const width = Math.max(320, labels.length * 56);
  const max = niceMax(Math.max(...values, 1));
  const padLeft = 34;
  const padBottom = 28;
  const padTop = 16;
  const plotH = height - padBottom - padTop;
  const plotW = width - padLeft - 8;
  const barGap = 14;
  const barW = Math.min(44, plotW / labels.length - barGap);

  const gridLines = [0, 0.5, 1].map((t) => {
    const y = padTop + plotH * (1 - t);
    const val = Math.round(max * t);
    return `
      <line x1="${padLeft}" y1="${y}" x2="${width - 4}" y2="${y}" stroke="${AXIS}" stroke-width="1" />
      <text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="${AXIS_TEXT}">${val}</text>
    `;
  }).join("");

  const bars = labels.map((label, i) => {
    const v = values[i];
    const barH = max === 0 ? 0 : (v / max) * plotH;
    const x = padLeft + i * (plotW / labels.length) + ((plotW / labels.length) - barW) / 2;
    const y = padTop + plotH - barH;
    return `
      <rect class="chart-bar chart-bar--grow-v" style="animation-delay:${i * 45}ms;" x="${x}" y="${y}" width="${barW}" height="${Math.max(barH, 1)}" rx="4"
        fill="${TEAL}" data-label="${escapeHtml(label)}" data-value="${v}" />
      <text x="${x + barW / 2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="${AXIS_TEXT}">${escapeHtml(label)}</text>
    `;
  }).join("");

  return `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Bar chart">
      ${gridLines}
      <line x1="${padLeft}" y1="${padTop + plotH}" x2="${width - 4}" y2="${padTop + plotH}" stroke="${AXIS}" stroke-width="1.5" />
      ${bars}
    </svg>
  `;
}

// Horizontal bar chart — better for longer category labels (medicine names).
export function renderHBarChart({ labels, values, rowHeight = 34 }) {
  const width = 460;
  const height = labels.length * rowHeight + 8;
  const max = niceMax(Math.max(...values, 1));
  const labelW = 140;
  const plotW = width - labelW - 40;

  const rows = labels.map((label, i) => {
    const v = values[i];
    const barW = max === 0 ? 0 : (v / max) * plotW;
    const y = i * rowHeight + 6;
    return `
      <text x="${labelW - 10}" y="${y + rowHeight / 2 + 4}" text-anchor="end" font-size="12" fill="var(--ink-700, #3f4a58)" font-weight="600">${escapeHtml(label)}</text>
      <rect class="chart-bar chart-bar--grow-h" style="animation-delay:${i * 45}ms;" x="${labelW}" y="${y}" width="${Math.max(barW, 2)}" height="${rowHeight - 12}" rx="4"
        fill="${TEAL}" data-label="${escapeHtml(label)}" data-value="${v}" />
      <text x="${labelW + barW + 8}" y="${y + rowHeight / 2 - 6 + 4}" font-size="11" fill="${AXIS_TEXT}">${v}</text>
    `;
  }).join("");

  return `
    <svg class="chart-svg chart-svg--h" viewBox="0 0 ${width} ${height}" role="img" aria-label="Horizontal bar chart">
      ${rows}
    </svg>
  `;
}

// Shared hover tooltip for any chart container rendered by the two functions
// above. Call once per container after inserting the chart's HTML.
export function wireChartTooltip(container) {
  let tooltip = container.querySelector(".chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    container.style.position = "relative";
    container.appendChild(tooltip);
  }

  container.querySelectorAll(".chart-bar").forEach((bar) => {
    bar.addEventListener("mouseenter", () => {
      tooltip.textContent = `${bar.dataset.label}: ${bar.dataset.value}`;
      tooltip.classList.add("is-visible");
    });
    bar.addEventListener("mousemove", (e) => {
      const rect = container.getBoundingClientRect();
      tooltip.style.left = `${e.clientX - rect.left + 12}px`;
      tooltip.style.top = `${e.clientY - rect.top - 28}px`;
    });
    bar.addEventListener("mouseleave", () => {
      tooltip.classList.remove("is-visible");
    });
  });
}
