import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { TimelineData } from '../types';

export const TimelinePlot = ({ data, width, height }: { data: TimelineData, width: number, height: number }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.years.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 30, right: 200, bottom: 50, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(data.years) as [number, number])
      .range([0, w]);

    // Calculate Y domain across all series
    let maxY = 0;
    let maxCluster = 0;

    data.series.forEach(s => {
        // Check line max
        const lineMax = d3.max(s.line) || 0;
        if (lineMax > maxY) maxY = lineMax;
        
        // Check stack max
        const clusterKeys = Object.keys(s.stacks);
        for(let i=0; i<data.years.length; i++) {
            let sum = 0;
            clusterKeys.forEach(k => {
                sum += s.stacks[k][i];
                const c = parseInt(k);
                if (c > maxCluster) maxCluster = c;
            });
            if(sum > maxY) maxY = sum;
        }
    });
    
    const y = d3.scaleLinear().domain([0, maxY * 1.1]).range([h, 0]);
    
    // Use Plasma for clusters
    const colorScale = d3.scaleSequential(d3.interpolatePlasma).domain([0, maxCluster || 1]);

    // Draw Series (Stacks + Lines)
    data.series.forEach(s => {
        // Sort numerically so stack order is consistent (0 at bottom)
        const clusterKeys = Object.keys(s.stacks).sort((a, b) => parseInt(a) - parseInt(b));
        
        const stackInput = data.years.map((year, i) => {
            const obj: any = { year };
            clusterKeys.forEach(k => {
                obj[k] = s.stacks[k][i];
            });
            return obj;
        });

        const stack = d3.stack().keys(clusterKeys);
        const seriesData = stack(stackInput);

        // Draw Area
        g.selectAll(`path.area-${s.label.replace(/\s+/g, '')}`)
            .data(seriesData)
            .join("path")
            .attr("class", "area")
            .attr("fill", d => colorScale(parseInt(d.key)))
            .attr("opacity", 0.3)
            .attr("d", d3.area<any>()
                .x(d => x(d.data.year))
                .y0(d => y(d[0]))
                .y1(d => y(d[1]))
            );

        // Draw Line
        const lineGen = d3.line<number>()
            .x((_, i) => x(data.years[i]))
            .y(d => y(d));
        
        g.append("path")
            .datum(s.line)
            .attr("fill", "none")
            .attr("stroke", s.color)
            .attr("stroke-width", 2)
            .attr("d", lineGen);
    });

    // Axes
    g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    g.append("g").call(d3.axisLeft(y));
    
    // Axis Labels
    g.append("text")
        .attr("x", w / 2)
        .attr("y", h + 35)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Year");

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -h / 2)
        .attr("y", -40)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("% of Wrecks");

    // Title
    svg.append("text").attr("x", w/2).attr("y", -10).style("text-anchor", "middle").text("Wrecks per year (Normalized by Subpopulation Total)");

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${w + 20}, 0)`);
    let legendY = 0;
    
    // Lines Legend
    data.series.forEach(s => {
        const lg = legend.append("g").attr("transform", `translate(0, ${legendY})`);
        lg.append("line").attr("x1", 0).attr("x2", 15).attr("y1", 5).attr("y2", 5).attr("stroke", s.color).attr("stroke-width", 2);
        lg.append("text").attr("x", 20).attr("y", 9).text(s.label).style("font-size", "10px");
        legendY += 20;
    });

    // Clusters Legend
    if (data.series.length > 0) {
        const clusterKeys = Object.keys(data.series[0].stacks).sort((a, b) => parseInt(a) - parseInt(b));
        clusterKeys.forEach(k => {
            const lg = legend.append("g").attr("transform", `translate(0, ${legendY})`);
            lg.append("rect").attr("width", 15).attr("height", 10).attr("fill", colorScale(parseInt(k))).attr("opacity", 0.3);
            lg.append("text").attr("x", 20).attr("y", 9).text(`Cluster ${k}`).style("font-size", "10px");
            legendY += 20;
        });
    }

  }, [data, width, height]);

  return <svg ref={svgRef} width={width} height={height} style={{border: '1px solid #eee', background: 'white'}} />;
};