export interface MapData {
  extent?: [number, number, number, number];
  heatmap?: number[][];
  points?: { lat: number; lon: number; cluster: number }[];
}

export interface ClusterData {
  km_to_coast: number;
  km_to_neighbor: number;
  cluster: number;
}

export interface TimelineSeries {
  label: string;
  color: string;
  stacks: { [key: string]: number[] };
  line: number[];
}

export interface TimelineData {
  years: number[];
  series: TimelineSeries[];
}