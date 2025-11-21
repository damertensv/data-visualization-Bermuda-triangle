import * as d3 from "d3";

// --- Types ---
type Wreck = {
  lat: number;
  lon: number;
  year: number;
};

// --- Constants ---
const WIDTH = 600;
const HEIGHT = 600;
const TRIANGLE_COORDS = [
  [-80.19, 25.774],
  [-66.105, 18.466],
  [-64.75, 32.3078],
  [-80.19, 25.774] // Close the loop
];

// --- Elements ---
const svg = d3.select("#map").attr("width", WIDTH).attr("height", HEIGHT);
const canvas = document.getElementById("heatmap") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// Inputs
const els = {
  lat: document.getElementById("lat") as HTMLInputElement,
  lon: document.getElementById("lon") as HTMLInputElement,
  zoom: document.getElementById("zoom") as HTMLInputElement,
  showWrecks: document.getElementById("showWrecks") as HTMLInputElement,
  showTriangle: document.getElementById("showTriangle") as HTMLInputElement,
  showOverlay: document.getElementById("showOverlay") as HTMLInputElement,
  smooth: document.getElementById("smooth") as HTMLInputElement,
  yearMin: document.getElementById("yearMin") as HTMLInputElement,
  yearMax: document.getElementById("yearMax") as HTMLInputElement,
  kNearest: document.getElementById("kNearest") as HTMLInputElement,
  maxDist: document.getElementById("maxDist") as HTMLInputElement,
  resolution: document.getElementById("resolution") as HTMLInputElement,
  // Labels
  valLat: document.getElementById("val-lat")!,
  valLon: document.getElementById("val-lon")!,
  valZoom: document.getElementById("val-zoom")!,
  valYears: document.getElementById("val-years")!,
  valK: document.getElementById("val-k")!,
  valDist: document.getElementById("val-dist")!,
  valRes: document.getElementById("val-res")!,
};

// --- State ---
let wrecks: Wreck[] = [];
let worldData: any = null;

// --- Initialization ---
async function init() {
  // 1. Load Data
  // Reading from "data/" relative to the web root
  const rawWrecks = await d3.csv("data/wrecks.csv"); 
  wrecks = rawWrecks
    .map(d => ({
      lat: +d.lat!,
      lon: +d.lon!,
      year: new Date(d.date!).getFullYear()
    }))
    .filter(d => !isNaN(d.lat) && !isNaN(d.lon) && !isNaN(d.year));

  worldData = await d3.json("data/countries.json");

  // 2. Set Input Defaults based on Data
  const years = wrecks.map(d => d.year);
  const minYear = d3.min(years) || 1900;
  const maxYear = d3.max(years) || 2020;

  els.yearMin.min = els.yearMax.min = String(minYear);
  els.yearMin.max = els.yearMax.max = String(maxYear);
  els.yearMin.value = "1996"; 
  els.yearMax.value = "2009";

  els.lat.value = "25.0";
  els.lon.value = "-75.0";
  els.zoom.value = "4.7";
  els.kNearest.value = "20";
  els.maxDist.value = "2.0";
  els.resolution.value = "50";

  // Utility: Debounce
  function debounce(fn: Function, ms: number) {
    let timer: number;
    return (...args: any[]) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  const debouncedUpdate = debounce(update, 15);

  // 3. Attach Listeners
  Object.values(els).forEach(el => {
    if (el instanceof HTMLInputElement) {
      el.addEventListener("input", debouncedUpdate);
    }
  });

  // 4. Initial Draw
  update();
}

// --- Core Logic ---

function proportionGrid(
  xMin: number, xMax: number, yMin: number, yMax: number,
  res: number, k: number, maxDist: number, 
  yearStart: number, yearEnd: number
) {
  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = res;
  gridCanvas.height = res;
  const gridCtx = gridCanvas.getContext("2d")!;
  const imgData = gridCtx.createImageData(res, res);
  
  const xStep = (xMax - xMin) / res;
  const yStep = (yMax - yMin) / res;
  const maxDistSq = maxDist * maxDist;

  // Optimization: Pre-filter wrecks to viewport + margin
  const margin = maxDist * 2;
  const relevantWrecks = wrecks.filter(w => 
    w.lon >= xMin - margin && w.lon <= xMax + margin &&
    w.lat >= yMin - margin && w.lat <= yMax + margin
  );

  const colorScale = d3.scaleSequential(d3.interpolateCool).domain([0, 1]);

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      // Grid point coordinates
      const cx = xMin + i * xStep;
      const cy = yMin + j * yStep;

      // Calculate squared distances
      const dists = relevantWrecks.map(w => {
        const dx = cx - w.lon;
        const dy = cy - w.lat;
        return { 
          dSq: dx*dx + dy*dy, 
          year: w.year 
        };
      });
      
      // Find K nearest
      // Partial sort optimization: we only need the top K. 
      // For JS, full sort is often fast enough for N < 5000.
      dists.sort((a, b) => a.dSq - b.dSq);
      
      const nearest = dists.slice(0, k);
      
      let inWindowCount = 0;
      let validCount = 0;

      for (const n of nearest) {
        if (n.dSq <= maxDistSq) {
          validCount++;
          if (n.year >= yearStart && n.year <= yearEnd) {
            inWindowCount++;
          }
        }
      }

      const prop = validCount > 0 ? inWindowCount / validCount : 0;
      
      // Map to image data (origin bottom-left for map, top-left for image)
      const pixelIndex = ((res - 1 - j) * res + i) * 4;
      
      if (validCount === 0) {
        imgData.data[pixelIndex + 3] = 0; 
      } else {
        const c = d3.rgb(colorScale(prop));
        imgData.data[pixelIndex] = c.r;
        imgData.data[pixelIndex + 1] = c.g;
        imgData.data[pixelIndex + 2] = c.b;
        imgData.data[pixelIndex + 3] = 150; // Alpha
      }
    }
  }

  gridCtx.putImageData(imgData, 0, 0);
  return gridCanvas;
}

function update() {
  // 1. Read Inputs
  const lat = parseFloat(els.lat.value);
  const lon = parseFloat(els.lon.value);
  const zoom = parseFloat(els.zoom.value);
  
  let y1 = parseInt(els.yearMin.value);
  let y2 = parseInt(els.yearMax.value);
  if (y1 > y2) [y1, y2] = [y2, y1];

  const k = parseInt(els.kNearest.value);
  const maxDist = parseFloat(els.maxDist.value);
  const res = parseInt(els.resolution.value);

  // Update Labels
  els.valLat.textContent = lat.toFixed(2);
  els.valLon.textContent = lon.toFixed(2);
  els.valZoom.textContent = zoom.toFixed(2);
  els.valYears.textContent = `${y1} - ${y2}`;
  els.valK.textContent = String(k);
  els.valDist.textContent = maxDist.toFixed(2);
  els.valRes.textContent = String(res);

  // 2. Setup Projection
  const margin = 100 * (1 / zoom);
  const xMin = lon - margin;
  const xMax = lon + margin;
  const yMin = lat - margin;
  const yMax = lat + margin;

  const projection = d3.geoIdentity()
    .reflectY(true)
    .fitExtent([[0, 0], [WIDTH, HEIGHT]], {
      type: "LineString", 
      coordinates: [[xMin, yMin], [xMax, yMax]]
    } as any);

  const path = d3.geoPath().projection(projection);

  // 3. Draw SVG Layers
  svg.selectAll("*").remove();

  // Countries
  if (worldData) {
    svg.append("g")
      .selectAll("path")
      .data(worldData.features)
      .join("path")
      .attr("d", path as any)
      .attr("fill", "teal")
      .attr("stroke", "black")
      .attr("stroke-width", 0.5);
  }

  // Triangle
  if (els.showTriangle.checked) {
    const triangleGeo = {
      type: "Polygon",
      coordinates: [TRIANGLE_COORDS]
    };
    svg.append("path")
      .datum(triangleGeo)
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-width", 2);
  }

  // Wrecks
  if (els.showWrecks.checked) {
    const visibleWrecks = wrecks.filter(d => 
      d.year >= y1 && d.year <= y2 &&
      d.lon >= xMin && d.lon <= xMax &&
      d.lat >= yMin && d.lat <= yMax
    );

    svg.append("g")
      .selectAll("circle")
      .data(visibleWrecks)
      .join("circle")
      .attr("cx", d => projection([d.lon, d.lat])![0])
      .attr("cy", d => projection([d.lon, d.lat])![1])
      .attr("r", 2) 
      .attr("fill", "crimson")
      .attr("opacity", 0.6);
  }

  // 4. Draw Heatmap (Canvas)
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  
  if (els.showOverlay.checked) {
    const heatCanvas = proportionGrid(xMin, xMax, yMin, yMax, res, k, maxDist, y1, y2);
ctx.imageSmoothingEnabled = els.smooth.checked;
ctx.drawImage(heatCanvas, 0, 0, WIDTH, HEIGHT);
}
}

init();