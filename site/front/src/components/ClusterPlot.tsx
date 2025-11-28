import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { ClusterData } from '../types';

export const ClusterPlot = ({ data, width, height }: { data: ClusterData[], width: number, height: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !svgRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const svg = d3.select(svgRef.current);
    if (!ctx) return;

    // Margins
    const margin = { top: 20, right: 80, bottom: 50, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    // Scales
    const xMax = d3.max(data, d => d.km_to_coast) || 100;
    const yMax = d3.max(data, d => d.km_to_neighbor) || 100;

    const x = d3.scaleLinear().domain([0, xMax]).range([0, w]);
    const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);
    
    // Plasma color scheme
    const maxCluster = d3.max(data, d => d.cluster) || 1;
    const colorScale = d3.scaleSequential(d3.interpolatePlasma).domain([0, maxCluster]);

    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // CHANGED: Use .ticks(width / 80) to dynamically adjust tick count based on width
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).ticks(width / 80));
      
    g.append("g").call(d3.axisLeft(y));

    // Axis Labels
    svg.append("text").attr("x", margin.left + w/2).attr("y", height - 10).style("text-anchor", "middle").text("Distance to Coast (km)");
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -(margin.top + h/2)).attr("y", 20).style("text-anchor", "middle").text("Distance to Neighbor (km)");

    // Legend
    const clusters = Array.from(new Set(data.map(d => d.cluster))).sort((a, b) => a - b);
    const legend = svg.append("g").attr("transform", `translate(${width - 70}, ${margin.top})`);
    
    clusters.forEach((c, i) => {
      const lg = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
      lg.append("rect").attr("width", 10).attr("height", 10).attr("fill", colorScale(c));
      lg.append("text").attr("x", 15).attr("y", 10).text(`Cluster ${c}`).style("font-size", "10px");
    });

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(margin.left, margin.top);
    
    data.forEach(d => {
      ctx.fillStyle = colorScale(d.cluster);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(x(d.km_to_coast), y(d.km_to_neighbor), 2, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    ctx.restore();

  }, [data, width, height]);

  return (
    <div style={{ position: 'relative', width, height, border: '1px solid #eee', background: 'white' }}>
      <svg ref={svgRef} width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }} />
      <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }} />
    </div>
  );
};