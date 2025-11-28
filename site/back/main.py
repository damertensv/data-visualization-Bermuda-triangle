from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fns import do_with, world_geojson

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The exact arguments from the notebook's interact()
class InspectParams(BaseModel):
    lat: float
    lon: float
    zoom: float
    wrecks: bool
    years: tuple[int, int]
    triangle: bool
    overlay: bool
    smooth: bool
    k_nearest: int
    max_dist: float
    resolution: int
    n_clusters: int
    timeline: str

@app.get("/api/static/world")
def get_world():
    return world_geojson()

@app.post("/api/inspect")
def inspect_endpoint(params: InspectParams):
    # Convert Pydantic model to dict and run logic
    return do_with(params.dict())