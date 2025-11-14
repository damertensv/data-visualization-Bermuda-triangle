import * as d3 from "d3";

type Row = { date: string; in_bermuda: string | boolean };

const svg = d3.select<SVGSVGElement, unknown>("#chart");
const stats = document.getElementById("stats") as HTMLDivElement;

const fromYearEl = document.getElementById("fromYear") as HTMLInputElement;
const toYearEl   = document.getElementById("toYear") as HTMLInputElement;
const showTotalEl = document.getElementById("showTotal") as HTMLInputElement;
const showInEl    = document.getElementById("showIn") as HTMLInputElement;
const showOutEl   = document.getElementById("showOut") as HTMLInputElement;
const normalizeEl = document.getElementById("normalize") as HTMLInputElement;

const margin = { top: 30, right: 20, bottom: 40, left: 55 };
const w = +svg.attr("width") - margin.left - margin.right;
const h = +svg.attr("height") - margin.top - margin.bottom;
const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const xScale = d3.scaleLinear().range([0, w]);
const yScale = d3.scaleLinear().range([h, 0]);
const line = d3.line<{ year: number; value: number }>()
  .x(d => xScale(d.year))
  .y(d => yScale(d.value));

g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${h})`);
g.append("g").attr("class", "y-axis");
g.append("text").attr("class", "title").attr("x", w / 2).attr("y", -10).attr("text-anchor", "middle");

function pearson(a: number[], b: number[]) {
  const n = a.length, ma = d3.mean(a) ?? 0, mb = d3.mean(b) ?? 0;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const dx = a[i] - ma, dy = b[i] - mb; num += dx * dy; da += dx * dx; db += dy * dy; }
  return num / Math.sqrt(Math.max(da * db, 1e-12));
}
function spearman(a: number[], b: number[]) {
  const rank = (arr: number[]) => {
    const order = arr.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v);
    const r = Array(arr.length);
    for (let k = 0; k < order.length; k++) r[order[k].i] = k + 1;
    return r as number[];
  };
  return pearson(rank(a), rank(b));
}

async function init() {
  // Load data (CSV exported from the notebook)
  const wrecks = await d3.csv<Row>("data/timeseries.csv", d => ({
    date: d.date!,
    in_bermuda: d.in_bermuda === "True" || d.in_bermuda === "1"
  }));

  // Aggregate by year.
  const yearMap = d3.rollup(
    wrecks,
    v => ({
      total: v.length,
      in: v.filter(d => d.in_bermuda as boolean).length,
      out: v.filter(d => !(d.in_bermuda as boolean)).length
    }),
    d => new Date(d.date as string).getFullYear()
  );

  const years = Array.from(yearMap.keys()).sort(d3.ascending);
  const minYear = d3.min(years)!; const maxYear = d3.max(years)!;

  // Initialize inputs.
  Object.assign(fromYearEl, { min: String(minYear), max: String(maxYear), value: String(minYear) });
  Object.assign(toYearEl,   { min: String(minYear), max: String(maxYear), value: String(maxYear) });

  function update() {
    let fy = Number(fromYearEl.value);
    let ty = Number(toYearEl.value);
    if (fy > ty) [fy, ty] = [ty, fy];

    const slice = years.filter(y => y >= fy && y <= ty).map(year => ({ year, ...(yearMap.get(year) as any) }));

    let totals = slice.map(d => d.total as number);
    let inVals = slice.map(d => d.in as number);
    let outVals = slice.map(d => d.out as number);

    if (normalizeEl.checked) {
      const sT = d3.sum(totals) || 1, sI = d3.sum(inVals) || 1, sO = d3.sum(outVals) || 1;
      totals = totals.map(v => v / sT);
      inVals = inVals.map(v => v / sI);
      outVals = outVals.map(v => v / sO);
    }

    xScale.domain([fy, ty]);
    const allY: number[] = [];
    if (showTotalEl.checked) allY.push(...totals);
    if (showInEl.checked)    allY.push(...inVals);
    if (showOutEl.checked)   allY.push(...outVals);
    yScale.domain([0, d3.max(allY) || 1]);

    type Series = { key: string; values: { year: number; value: number }[] };
    const series: Series[] = [];
    if (showTotalEl.checked) series.push({ key: normalizeEl.checked ? "% total" : "total", values: slice.map((d, i) => ({ year: d.year, value: totals[i] })) });
    if (showInEl.checked)    series.push({ key: normalizeEl.checked ? "% in Bermuda" : "in Bermuda", values: slice.map((d, i) => ({ year: d.year, value: inVals[i] })) });
    if (showOutEl.checked)   series.push({ key: normalizeEl.checked ? "% outside" : "outside", values: slice.map((d, i) => ({ year: d.year, value: outVals[i] })) });

    const color = d3.scaleOrdinal<string, string>().domain(series.map(s => s.key)).range(d3.schemeTableau10 as unknown as string[]);

    const paths = g.selectAll<SVGPathElement, Series>("path.line").data(series, d => d.key);
    paths.join(
      enter => enter.append("path").attr("class", "line").attr("fill", "none").attr("stroke-width", 1.8)
        .attr("stroke", d => color(d.key)).attr("d", d => line(d.values)!),
      upd => upd.attr("stroke", d => color(d.key)).attr("d", d => line(d.values)!),
      exit => exit.remove()
    );

    g.select<SVGGElement>(".x-axis").call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
    g.select<SVGGElement>(".y-axis").call(d3.axisLeft(yScale));
    g.select<SVGTextElement>(".title").text(normalizeEl.checked ? "Wrecks (normalized)" : "Wrecks per year");

    if (inVals.length > 1 && outVals.length > 1) {
      stats.textContent = `Pearson (in vs out): ${pearson(inVals, outVals).toFixed(4)}  Spearman: ${spearman(inVals, outVals).toFixed(4)}`;
    } else {
      stats.textContent = "";
    }
  }

  ["input", "change"].forEach(ev => {
    fromYearEl.addEventListener(ev, update);
    toYearEl.addEventListener(ev, update);
    showTotalEl.addEventListener(ev, update);
    showInEl.addEventListener(ev, update);
    showOutEl.addEventListener(ev, update);
    normalizeEl.addEventListener(ev, update);
  });

  update();
}

init();