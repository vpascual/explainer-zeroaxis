const svg = d3.select("#chart");

// --- Config ---
const cfg = {
  margin: { top: 18, right: 18, bottom: 44, left: 52 },
  n: 12,
  valueRange: [80, 120],
  baselinePad: 10, // fins a min(data)-pad
};

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
const takeaway = document.querySelector("#takeaway");

// --- Init ---
setupSvg();
setupControls();
syncBaselineLimitsToData();
render();

// --- Functions ---
function setupSvg() {
  svg.attr("viewBox", `0 0 ${svg.attr("width")} ${svg.attr("height")}`);

  svg.append("g").attr("class", "plot");
  svg.append("g").attr("class", "x-axis");
  svg.append("g").attr("class", "y-axis");
  svg.append("g").attr("class", "grid");
  svg.append("g").attr("class", "marks");
}

function setupControls() {
  btnRandom.addEventListener("click", () => {
    state.data = makeData(cfg.n, cfg.valueRange);
    // mantenim baseline si encara és vàlid; si no, el clamp
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
  // categories A..L i valors random amb una mica de variabilitat
  const cats = d3.range(n).map(i => String.fromCharCode(65 + i));
  return cats.map(c => ({
    x: c,
    y: Math.round(lo + Math.random() * (hi - lo)),
  }));
}

function syncBaselineLimitsToData(clamp = false) {
  const minY = d3.min(state.data, d => d.y);
  const maxY = d3.max(state.data, d => d.y);

  // Baseline slider: 0..(minY - pad) però mai < 0
  const maxBaseline = Math.max(0, Math.floor(minY - cfg.baselinePad));

  baselineInput.min = "0";
  baselineInput.max = String(maxBaseline);
  baselineInput.step = "1";

  if (clamp) state.baseline = Math.max(0, Math.min(state.baseline, maxBaseline));
  baselineInput.value = String(state.baseline);

  // UI text
  baselineValue.textContent = String(state.baseline);
  hint.textContent = maxBaseline === 0
    ? `Aquest dataset no permet tallar gaire (min=${minY}, max=${maxY}).`
    : `Pots tallar fins a ${maxBaseline} (min=${minY}, max=${maxY}).`;

  updateTakeaway();
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

  const y0 = state.baseline;           // baseline (possibly >0)
  const y1 = Math.max(maxY, y0);       // ensure domain is valid

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

  const gPlot = svg.select(".plot")
    .attr("transform", `translate(${left},${top})`);

  // Grid (y)
  const yTicks = y.ticks(5);
  const grid = svg.select(".grid")
    .attr("transform", `translate(${left},${top})`);

  grid.selectAll("line")
    .data(yTicks, d => d)
    .join(
      enter => enter.append("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", d => y(d)).attr("y2", d => y(d))
        .attr("stroke", "rgba(255,255,255,.08)"),
      update => update
        .attr("y1", d => y(d)).attr("y2", d => y(d)),
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
    // baseline line
    marks.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", y(y0)).attr("y2", y(y0))
      .attr("stroke", "rgba(255,255,255,.25)");

    marks.selectAll("rect")
      .data(state.data, d => d.x)
      .join("rect")
      .attr("x", d => xBand(d.x))
      .attr("width", xBand.bandwidth())
      .attr("y", d => y(Math.max(d.y, y0)))
      .attr("height", d => Math.max(0, y(y0) - y(d.y)))
      .attr("rx", 6)
      .attr("fill", "rgba(255,255,255,.18)")
      .attr("stroke", "rgba(255,255,255,.30)");

  } else {
    const line = d3.line()
      .x(d => xPoint(d.x))
      .y(d => y(d.y));

    marks.append("path")
      .datum(state.data)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,.70)")
      .attr("stroke-width", 2);

    marks.selectAll("circle")
      .data(state.data, d => d.x)
      .join("circle")
      .attr("cx", d => xPoint(d.x))
      .attr("cy", d => y(d.y))
      .attr("r", 4)
      .attr("fill", "rgba(255,255,255,.85)");

    // optional: baseline reference
    marks.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", y(y0)).attr("y2", y(y0))
      .attr("stroke", "rgba(255,255,255,.18)");
  }

  // Update UI text (baseline)
  baselineValue.textContent = String(state.baseline);
  updateTakeaway(minY, maxY);
}

function styleAxis(g) {
  g.selectAll("path, line").attr("stroke", "rgba(255,255,255,.18)");
  g.selectAll("text").attr("fill", "rgba(255,255,255,.75)").attr("font-size", 12);
}

function updateTakeaway(minY, maxY) {
  const minVal = minY ?? d3.min(state.data, d => d.y);
  const maxVal = maxY ?? d3.max(state.data, d => d.y);

  const range = maxVal - minVal;
  const baseline = state.baseline;

  // “Distorsió” simple: quina part del rang real estàs “ampliant” en pantalla
  // quan talles per sobre de 0 (només orientatiu)
  const denom = (maxVal - 0) || 1;
  const visible = (maxVal - baseline) || 1;
  const amplification = denom / visible;

  const modeText = state.mode === "bars"
    ? "Barres: tallar l’eix sol exagerar diferències perquè la magnitud es llegeix des de 0."
    : "Línia: tallar l’eix canvia la percepció de variació, però no trenca la semàntica de “mida des de 0” com en barres.";

  const ampText = baseline > 0
    ? `Amb baseline=${baseline}, estàs comprimint l’interval visible. Amplificació aprox.: x${amplification.toFixed(2)}.`
    : "Amb baseline=0, no hi ha tall de l’eix.";

  takeaway.textContent = `${modeText} Dades: min=${minVal}, max=${maxVal}, rang=${range}. ${ampText}`;
}
