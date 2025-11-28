import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { MapData } from '../types';

interface Props {
  data: MapData;
  geoJson: any;
  params: { triangle: boolean; smooth: boolean };
  width: number;
  height: number;
}

export const WorldMap = ({ data, geoJson, params, width, height }: Props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const triangleCoords: [number, number][] = [
    [-80.19, 25.774], [-66.105, 18.466], [-64.75, 32.3078], [-80.19, 25.774]
  ];

  useEffect(() => {
    if (!svgRef.current || !canvasRef.current || !data.extent) return;
    const svg = d3.select(svgRef.current);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const [xmin, xmax, ymin, ymax] = data.extent;

    // 1. Use Linear Scales to match the heatmap grid structure
    // This mimics how matplotlib plots raw lat/lon on a standard axis
    const xScale = d3.scaleLinear().domain([xmin, xmax]).range([0, width]);
    const yScale = d3.scaleLinear().domain([ymin, ymax]).range([height, 0]); // Flip Y for canvas

    // 2. Create a custom projection for the vector layers (countries)
    // This ensures the GeoJSON lines up perfectly with our linear heatmap
    const projection = d3.geoTransform({
      point: function(x, y) {
        this.stream.point(xScale(x), yScale(y));
      }
    });

    const pathGenerator = d3.geoPath().projection(projection);

    // --- SVG Drawing (Vector Layers) ---
    svg.selectAll("*").remove();
    
    // Countries
    if (geoJson) {
      svg.append("g")
        .selectAll("path")
        .data(geoJson.features)
        .join("path")
        .attr("d", pathGenerator as any)
        .attr("fill", "teal")
        .attr("stroke", "black")
        .attr("stroke-width", 0.5);
    }

    // Triangle
    if (params.triangle) {
      const line = d3.line<[number, number]>()
        .x(d => xScale(d[0]))
        .y(d => yScale(d[1]));
      
      svg.append("path")
        .datum(triangleCoords)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    }

    // --- Canvas Drawing (Raster Layers) ---
    ctx.clearRect(0, 0, width, height);

    // Heatmap (IMSHOW implementation)
    if (data.heatmap && data.heatmap.length > 0) {
      const grid = data.heatmap; // The 2D array directly
      const rows = grid.length;
      const cols = grid[0].length;

      // Create offscreen canvas
      const offscreen = document.createElement('canvas');
      offscreen.width = cols;
      offscreen.height = rows;
      const offCtx = offscreen.getContext('2d');

      if (offCtx) {
        const imgData = offCtx.createImageData(cols, rows);
        
        // Color scale: Python uses 'coolwarm' (Blue=Low, Red=High)
        // d3.interpolateRdBu is Red=Low, Blue=High (reversed).
        // So we map val (0..1) to RdBu(1 - val).
        const colorScale = (t: number) => d3.interpolateRdBu(1 - t);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            // Python origin="lower" means grid[0] is at the bottom.
            // Canvas draws from top-left.
            // We must flip the row index: row 0 -> bottom of canvas image.
            const val = grid[r][c];
            const canvasRow = rows - 1 - r;
            const pIdx = (canvasRow * cols + c) * 4;

            if (val > 0) {
               const color = d3.color(colorScale(val));
               if (color) {
                 imgData.data[pIdx] = color.r;
                 imgData.data[pIdx + 1] = color.g;
                 imgData.data[pIdx + 2] = color.b;
                 imgData.data[pIdx + 3] = 153; // Alpha ~0.6 (255 * 0.6)
               }
            } else {
                imgData.data[pIdx + 3] = 0; // Transparent
            }
          }
        }
        
        offCtx.putImageData(imgData, 0, 0);

        // Draw scaled image onto main canvas
        // This handles the scaling automatically, removing grid lines
        ctx.imageSmoothingEnabled = params.smooth;
        ctx.drawImage(offscreen, 0, 0, width, height);
      }
    }

    // Points
    if (data.points) {
      const maxCluster = d3.max(data.points, d => d.cluster) || 1;
      const pointColorScale = d3.scaleSequential(d3.interpolatePlasma).domain([0, maxCluster]);

      data.points.forEach(pt => {
        const x = xScale(pt.lon);
        const y = yScale(pt.lat);
        
        // Only draw if within bounds (optional optimization)
        if (x >= -10 && x <= width + 10 && y >= -10 && y <= height + 10) {
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = pointColorScale(pt.cluster); 
            ctx.fill();
        }
      });
    }

  }, [data, geoJson, params, width, height]);

  return (
    <div style={{ position: 'relative', width, height, border: '1px solid #ccc', background: '#aadaff', overflow: 'hidden' }}>
      <svg ref={svgRef} width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, zIndex:1 }} /> <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }} /> </div> ); }