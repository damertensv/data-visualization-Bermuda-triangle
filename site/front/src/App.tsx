import { useState, useEffect } from 'react';
import Slider from 'rc-slider'; // CHANGED: Removed { Range }
import 'rc-slider/assets/index.css';
import { fetchAnalysis, fetchWorldGeoJSON } from './api';
import type { InspectParams, ApiResponse } from './types';
import { WorldMap } from './components/WorldMap';
import { ClusterPlot } from './components/ClusterPlot';
import { TimelinePlot } from './components/TimelinePlot';
import './App.css';

function App() {
  // State matching InspectParams
  const [params, setParams] = useState<InspectParams>({
    lat: 25.0,
    lon: -75.0,
    zoom: 4.7,
    wrecks: true,
    years: [2010, 2015],
    triangle: true,
    overlay: true,
    smooth: false,
    k_nearest: 20,
    max_dist: 2.0,
    resolution: 50,
    n_clusters: 3,
    timeline: "both in and out of Bermuda"
  });

  const [geoJson, setGeoJson] = useState<any>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Initial Load
  useEffect(() => {
    fetchWorldGeoJSON().then(setGeoJson).catch(console.error);
  }, []);

  // Fetch Data when params change
  useEffect(() => {
    setLoading(true);
    fetchAnalysis(params).then(res => {
      setData(res);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  }, [params]);

  const updateParam = (key: keyof InspectParams, val: any) => {
    setParams(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* Sidebar Controls */}
      <div style={{ width: '300px', padding: '20px', overflowY: 'auto', background: '#f5f5f5', borderRight: '1px solid #ddd' }}>
        <h3>Controls</h3>
        
        <div className="control-group">
          <label>Lat: {params.lat}</label>
          <Slider min={-90} max={90} value={params.lat} onChange={(v) => updateParam('lat', v)} />
        </div>
        <div className="control-group">
          <label>Lon: {params.lon}</label>
          <Slider min={-180} max={180} value={params.lon} onChange={(v) => updateParam('lon', v)} />
        </div>
        <div className="control-group">
          <label>Zoom: {params.zoom}</label>
          <Slider min={0.1} max={10} step={0.1} value={params.zoom} onChange={(v) => updateParam('zoom', v)} />
        </div>
        
        <div className="control-group">
          <label>
            <input type="checkbox" checked={params.wrecks} onChange={(e) => updateParam('wrecks', e.target.checked)} /> Show Wrecks
          </label>
        </div>

        <div className="control-group">
          <label>Years: {params.years[0]} - {params.years[1]}</label>
          {/* CHANGED: Use <Slider range /> instead of <Range /> */}
          <Slider range min={1996} max={2015} value={params.years} onChange={(v) => updateParam('years', v as number[])} />
        </div>

        <div className="control-group">
          <label>
            <input type="checkbox" checked={params.triangle} onChange={(e) => updateParam('triangle', e.target.checked)} /> Show Triangle
          </label>
        </div>
        <div className="control-group">
          <label>
            <input type="checkbox" checked={params.overlay} onChange={(e) => updateParam('overlay', e.target.checked)} /> Heatmap Overlay
          </label>
        </div>

        <hr />
        <h4>Analysis Params</h4>
        
        <div className="control-group">
          <label>K-Nearest: {params.k_nearest}</label>
          <Slider min={1} max={50} value={params.k_nearest} onChange={(v) => updateParam('k_nearest', v)} />
        </div>
        <div className="control-group">
          <label>Max Dist: {params.max_dist}</label>
          <Slider min={0.1} max={10} step={0.1} value={params.max_dist} onChange={(v) => updateParam('max_dist', v)} />
        </div>
        <div className="control-group">
          <label>Resolution: {params.resolution}</label>
          <Slider min={10} max={100} step={10} value={params.resolution} onChange={(v) => updateParam('resolution', v)} />
        </div>
        <div className="control-group">
          <label>Clusters: {params.n_clusters}</label>
          <Slider min={2} max={10} value={params.n_clusters} onChange={(v) => updateParam('n_clusters', v)} />
        </div>

        <div className="control-group">
          <label>Timeline Mode</label>
          <select value={params.timeline} onChange={(e) => updateParam('timeline', e.target.value)} style={{width: '100%'}}>
            <option value="both in and out of Bermuda">Both</option>
            <option value="only in Bermuda">Only In Bermuda</option>
            <option value="only outside Bermuda">Only Outside</option>
          </select>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '2fr 1fr', gap: '10px', padding: '10px' }}>
        
        {/* Top Left: Map */}
        <div style={{ gridColumn: '1 / 2', gridRow: '1 / 2', position: 'relative' }}>
          {data && geoJson && (
            <WorldMap 
              data={data.map_data} 
              geoJson={geoJson} 
              params={params} 
              width={800} 
              height={500} 
            />
          )}
          {loading && <div style={{position: 'absolute', top: 10, left: 10, background: 'white', padding: '5px', border: '1px solid #ccc'}}>Processing...</div>}
        </div>

        {/* Top Right: Clusters */}
        <div style={{ gridColumn: '2 / 3', gridRow: '1 / 2' }}>
          {data && <ClusterPlot data={data.cluster_data} width={400} height={500} />}
        </div>

        {/* Bottom: Timeline */}
        <div style={{ gridColumn: '1 / 3', gridRow: '2 / 3' }}>
          {data && <TimelinePlot data={data.timeline_data} width={1200} height={250} />}
</div>  </div>
</div>
  );
}

export default App;