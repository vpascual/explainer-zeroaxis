const svg = d3.select("#chart");

// --- Config ---
const cfg = {
  margin: { top: 18, right: 18, bottom: 44, left: 52 },
  n: 12,
  valueRange: [80, 120],
  baselinePad: 10, // slider max = min(data) - pad
};

// --- State ---
let state = {
  mode: "bars", // "bars" | "lines"
  data: makeData(cfg.n, cfg.valueRange),
  baseline: 0,
};

// --- UI refs ---
const btnRandom = document.querySelector("#btnRandom");
const btnBars = document.querySelector("#btnBars");
const btnLines = document.querySelector("#btnLines");
const btnReset = document.querySelector("#btnReset");

const baselineInput = document.querySelector("#baseline");
const baselineValue = document.querySelector("#baselineValue");
const hint = document.querySelector("#hint");

const explainTitle = document.querySelector("#explainTitle");
const explainText = document.querySelector("#explainText");

const meta = document.querySelector("#meta");

// --- Theme colors (match CSS intent) ---
const COLORS = {
  grid: "#e5e7eb",
  axis: "#cbd5e1",
  axisText: "#6b7280",
  baseline: "#c7cdd6",

  // bluish marks
  accent: "#2563eb",       // blue-600
  accentStroke: "#1d4ed8", // blue-700
  accentFill: "#93c5fd",   // blue-300
};

// --- Init ---
setupSvg();
setupControls();
syncBaselineLimitsToData(true);
render();

// --- Functions ---
function setupSvg() {
  svg.attr("viewBox", `0 0 ${svg.attr("width")} ${svg.attr("height")}`);
  svg.append("g").attr("class", "x-axis");
  svg.append("g").attr("class", "y-axis");
  svg.append("g").attr("class", "grid");
  svg.append("g").attr("class", "marks");
}

function setupControls() {
  btnRandom.addEventListener("click", () => {
    state.data = makeData(cfg.n, cfg.valueRange);
    syncBaselineLimitsToData(true);
    render();
  });

  btnBars.addEventListener("click", () => {
    state.mode = "bars";
    btnBars.classList.add("active");
    btnLines.classList.remove("active");
    render();
  });

  btnLines.addEventListener("click", () => {
    state.mode = "lines";
    btnLines.classList.add("active");
    btnBars.classList.remove("active");
    render();
  });

  btnReset.addEventListener("click", () => {
    state.baseline = 0;
    baselineInput.value = "0";
    render();
  });

  baselineInput.addEventListener("input", (e) => {
    state.baseline = +e.target.value;
    render();
  });
}

function makeData(n, [lo, hi]) {
  const cats = d3.range(n).map(i => String.fromCharCode(65 + i));
  return cats.map(c => ({
    x: c,
    y: Math.round(lo + Math.random() * (hi - lo)),
  }));
}

function syncBaselineLimitsToData(clamp = false) {
  const minY = d3.min(state.data, d => d.y);
  const maxY = d3.max(state.data, d => d.y);
  const maxBaseline = Math.max(0, Math.floor(minY - cfg.baselinePad));

  baselineInput.min = "0";
  baselineInput.max = String(maxBaseline);
  baselineInput.step = "1";

  if (clamp) state.baseline = Math.max(0, Math.min(state.baseline, maxBaseline));
  baselineInput.value = String(state.baseline);

  baselineValue.textContent = String(state.baseline);

  // Clearer hint (no "truncate down to ...")
  hint.textContent =
    `This dataset ranges from ${minY} to ${maxY}. ` +
    `Raising the y-axis minimum truncates the scale and can visually amplify differences.`;
}

function render() {
  syncBaselineLimitsToData(false);

  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const { top, right, bottom, left } = cfg.margin;

  const innerW = width - left - right;
  const innerH = height - top - bottom;

  const minY = d3.min(state.data, d => d.y);
  const maxY = d3.max(state.data, d => d.y);

  const y0 = state.baseline;
  const y1 = Math.max(maxY, y0);

  const xBand = d3.scaleBand()
    .domain(state.data.map(d => d.x))
    .range([0, innerW])
    .padding(state.mode === "bars" ? 0.18 : 0.1);

  const xPoint = d3.scalePoint()
    .domain(state.data.map(d => d.x))
    .range([0, innerW])
    .padding(0.5);

  const y = d3.scaleLinear()
    .domain([y0, y1]).nice()
    .range([innerH, 0]);

  // Grid
  const yTicks = y.ticks(5);
  svg.select(".grid")
    .attr("transform", `translate(${left},${top})`)
    .selectAll("line")
    .data(yTicks, d => d)
    .join(
      enter => enter.append("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", d => y(d)).attr("y2", d => y(d))
        .attr("stroke", COLORS.grid),
      update => update.attr("y1", d => y(d)).attr("y2", d => y(d)),
      exit => exit.remove()
    );

  // Axes
  const xAxis = d3.axisBottom(state.mode === "bars" ? xBand : xPoint).tickSizeOuter(0);
  const yAxis = d3.axisLeft(y).ticks(5).tickSizeOuter(0);

  svg.select(".x-axis")
    .attr("transform", `translate(${left},${top + innerH})`)
    .call(xAxis)
    .call(styleAxis);

  svg.select(".y-axis")
    .attr("transform", `translate(${left},${top})`)
    .call(yAxis)
    .call(styleAxis);

  // Marks
  const marks = svg.select(".marks")
    .attr("transform", `translate(${left},${top})`);

  marks.selectAll("*").remove();

  if (state.mode === "bars") {
    marks.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", y(y0)).attr("y2", y(y0))
      .attr("stroke", COLORS.baseline);

    marks.selectAll("rect")
      .data(state.data, d => d.x)
      .join("rect")
      .attr("x", d => xBand(d.x))
      .attr("width", xBand.bandwidth())
      .attr("y", d => y(Math.max(d.y, y0)))
      .attr("height", d => Math.max(0, y(y0) - y(d.y)))
      .attr("rx", 8)
      .attr("fill", COLORS.accentFill)
      .attr("fill-opacity", 0.55)
      .attr("stroke", COLORS.accentStroke)
      .attr("stroke-opacity", 0.45);

  } else {
    const line = d3.line()
      .x(d => xPoint(d.x))
      .y(d => y(d.y));

    marks.append("path")
      .datum(state.data)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", COLORS.accentStroke)
      .attr("stroke-width", 2.25)
      .attr("stroke-opacity", 0.9);

    marks.selectAll("circle")
      .data(state.data, d => d.x)
      .join("circle")
      .attr("cx", d => xPoint(d.x))
      .attr("cy", d => y(d.y))
      .attr("r", 4)
      .attr("fill", COLORS.accent)
      .attr("fill-opacity", 0.9);

    marks.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", y(y0)).attr("y2", y(y0))
      .attr("stroke", COLORS.baseline);
  }

  baselineValue.textContent = String(state.baseline);
  renderMeta(minY, maxY);
  renderExplain(minY, maxY);
}

function styleAxis(g) {
  g.selectAll("path, line").attr("stroke", COLORS.axis);
  g.selectAll("text").attr("fill", COLORS.axisText).attr("font-size", 12);
}

function renderMeta(minY, maxY) {
  const range = maxY - minY;
  const baseline = state.baseline;

  const denom = (maxY - 0) || 1;
  const visible = (maxY - baseline) || 1;
  const amplification = denom / visible;

  const ampText = baseline > 0
    ? `Visual amplification (approx.): ×${amplification.toFixed(2)}`
    : `No truncation (baseline at 0).`;

  meta.textContent = `Data: min=${minY}, max=${maxY}, range=${range}. ${ampText}`;
}

function renderExplain(minY, maxY) {
  const baseline = state.baseline;

  const common =
    `Data range: ${minY}–${maxY}. ` +
    `Raising the y-axis minimum truncates the scale and can visually amplify differences.`;

  if (state.mode === "bars") {
    explainTitle.textContent = "Why it matters (bars)";
    explainText.textContent =
      `${common} ` +
      `With bar charts, the baseline is part of the encoding: bar length is read as magnitude from the baseline. ` +
      `That’s why bars are generally expected to start at zero, truncation can be misleading.`;
  } else {
    explainTitle.textContent = "Why it matters (lines)";
    explainText.textContent =
      `${common} ` +
      `With line charts, a non-zero baseline can be ok when the goal is to emphasize variation, not absolute magnitude. ` +
      `It can still mislead if readers interpret the slope as “big change” without noticing the truncated axis, context matters.`;
  }
}
