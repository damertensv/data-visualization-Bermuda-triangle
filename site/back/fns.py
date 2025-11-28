import pandas as pd
import geopandas as gpd
import numpy as np
from shapely.geometry import Polygon
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from scipy.spatial import cKDTree
import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "shipwrecks_with_distance_to_neighbor.xlsx")
SHP_PATH = os.path.join(BASE_DIR, "data", "natural_earth", "ne_110m_admin_0_countries", "ne_110m_admin_0_countries.shp")

_wrecks_df = pd.read_excel(DATA_PATH)
_countries_gdf = gpd.read_file(SHP_PATH)
_countries_geojson = json.loads(_countries_gdf.to_json())

_bermuda_coords = [(-80.19, 25.774), (-66.105, 18.466), (-64.75, 32.3078), (-80.19, 25.774)]
_bermuda_poly = Polygon(_bermuda_coords)

def world_geojson():
    return _countries_geojson

def proportion_grid(xx, yy, years, gdf, k=10, max_dist=2.0):
    if gdf.empty:
        return np.zeros(xx.shape)

    wreck_coords = np.column_stack((gdf.geometry.x, gdf.geometry.y))
    
    if not np.all(np.isfinite(wreck_coords)):
        return np.zeros(xx.shape)

    wreck_tree = cKDTree(wreck_coords)
    w_years = gdf.date.dt.year.values

    n_wrecks = len(gdf)
    if k > n_wrecks: k = n_wrecks
    
    grid_points = np.column_stack((xx.ravel(), yy.ravel()))
    dists, indices = wreck_tree.query(grid_points, k=k)
    
    if k == 1:
        dists = dists.reshape(-1, 1)
        indices = indices.reshape(-1, 1)

    nearest_years = w_years[indices]
    t_min, t_max = years
    
    dist_mask = dists <= max_dist
    time_mask = (t_min <= nearest_years) & (nearest_years <= t_max)
    
    in_window = (dist_mask & time_mask).sum(axis=1)
    nn = dist_mask.sum(axis=1)

    prop = np.divide(
        in_window, 
        nn, 
        out=np.zeros_like(in_window, dtype=float), 
        where=0 < nn
    )
    return prop.reshape(xx.shape)

def do_with(params: dict):
    df = _wrecks_df.copy()
    
    df['lon'] = pd.to_numeric(df['lon'], errors='coerce')
    df['lat'] = pd.to_numeric(df['lat'], errors='coerce')
    
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.dropna(subset=['lon', 'lat'])

    if df.empty:
        return {
            "map_data": {"extent": [params['lon']-1, params['lon']+1, params['lat']-1, params['lat']+1]},
            "cluster_data": [],
            "timeline_data": {"years": [], "series": []}
        }

    features = df[["km_to_coast", "km_to_neighbor"]]
    iso = IsolationForest(contamination=0.01, random_state=42)
    is_inlier = iso.fit_predict(features)
    df = df[is_inlier == 1].copy()
    
    features = df[["km_to_coast", "km_to_neighbor"]]
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features)
    kmeans = KMeans(n_clusters=params['n_clusters'], random_state=42)
    df["cluster"] = kmeans.fit_predict(scaled_features)
    
    gs = gpd.GeoSeries(gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326", index=df.index)
    df["in_bermuda"] = gs.within(_bermuda_poly)
    df["year"] = df.date.dt.year

    # Re-create GDF for grid analysis
    gdf = gpd.GeoDataFrame(df, geometry=gs)

    map_response = {}
    lat, lon, zoom = params['lat'], params['lon'], params['zoom']
    margin = 100. * (1 / zoom)
    x_min, x_max = lon - margin, lon + margin
    y_min, y_max = lat - margin, lat + margin
    
    map_response['extent'] = [x_min, x_max, y_min, y_max]

    if params['overlay']:
        grid_x, grid_y = np.meshgrid(
            np.linspace(x_min, x_max, params['resolution']),
            np.linspace(y_min, y_max, params['resolution'])
        )
        prop_grid = proportion_grid(
            grid_x, grid_y, params['years'], gdf, 
            k=params['k_nearest'], max_dist=params['max_dist']
        )
        map_response['heatmap'] = prop_grid.tolist()

    if params['wrecks']:
        min_y, max_y = params['years']
        mask_geo = (df.lon >= x_min) & (df.lon <= x_max) & (df.lat >= y_min) & (df.lat <= y_max)
        mask_time = (df.year >= min_y) & (df.year <= max_y)
        filtered_pts = df[mask_geo & mask_time]
        map_response['points'] = filtered_pts[['lat', 'lon', 'cluster']].to_dict(orient='records')

    cluster_plot_data = df[['km_to_coast', 'km_to_neighbor', 'cluster']].to_dict(orient='records')

    min_y_all, max_y_all = int(df.year.min()), int(df.year.max())
    timeline_years = list(range(min_y_all, max_y_all + 1))
    
    allc = sorted(df["cluster"].unique())
    
    timeline_response = {
        "years": timeline_years,
        "series": []
    }

    def process_series(mask, name, color):
        sub_df = df[mask]
        if sub_df.empty:
            return

        # Group by year and cluster
        counts = sub_df.groupby(['year', 'cluster']).size().unstack(fill_value=0)
        counts = counts.reindex(timeline_years, fill_value=0)
        
        for c in allc:
            if c not in counts.columns:
                counts[c] = 0
        counts = counts[allc]
        
        y_stack = counts.values.T # (clusters, years)
        y_total = y_stack.sum(axis=0) # (years,)
        
        total_sum = y_total.sum() 
        
        if total_sum > 0:
            y_stack = y_stack / total_sum
            y_total = y_total / total_sum
            
        # Construct response
        series_data = {
            "label": name,
            "color": color,
            "stacks": {str(c): y_stack[i].tolist() for i, c in enumerate(allc)},
            "line": y_total.tolist()
        }
        timeline_response['series'].append(series_data)

    tl_mode = params['timeline'].lower()
    
    if "only in bermuda" in tl_mode or "both" in tl_mode:
        process_series(df.in_bermuda, "wrecks in Bermuda Triangle", "red")
        
    if "only outside" in tl_mode or "both" in tl_mode:
        process_series(~df.in_bermuda, "wrecks outside Bermuda Triangle", "blue")

    return {
        "map_data": map_response,
        "cluster_data": cluster_plot_data,
        "timeline_data": timeline_response
}