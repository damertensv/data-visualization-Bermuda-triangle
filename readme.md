# Data Visualization — Bermuda Triangle

Interactive D3.js panel that compares yearly counts of shipwrecks in the Bermuda Triangle vs. outside, with optional normalization and correlation stats. The notebooks prepare the data; the `site/` folder hosts the web UI (TypeScript + Vite + D3).

## Prerequisites
- Conda (Miniconda or Anaconda)
- Node.js 18+ and npm
- Git, and VS Code (recommended)

## 1) Python environment (conda)
Create and activate the project environment.

```powershell
conda env create -f env.yml
conda activate dvz
```

## 2) Prepare data (from the notebook)
Export the two columns used by the web app into `site/data/timeseries.csv`.

Expected CSV schema:
```csv
date,in_bermuda
2010-05-01 12:00:00,True
2010-05-02 08:30:00,False
...
```

If you’re working in `preliminary.ipynb`, run the export cell (at the bottom).

## 3) Web UI (npm + TypeScript + Vite)

You can either install from the existing `package.json` (recommended) or bootstrap from scratch.

### A) Install from existing package.json
```powershell
cd site
npm install
npm run dev
```
Open the printed URL (typically http://localhost:5173).

## Project structure
- `preliminary.ipynb` — data exploration and CSV export.
- `site/`
  - `index.html` — page shell.
  - `styles.css` — styling.
  - `src/main.ts` — D3 chart + interactions.
  - `data/timeseries.csv` — input data produced by the notebook.

## References
[1] Harris, J. (2022). What’s Really Happening in the Bermuda Triangle. https://www.youtube.com/watch?v=112H-vY4Wdo

[2] Google Sheets document. (n.d.). Retrieved November 14, 2025, from https://docs.google.com/spreadsheets/d/1ltkrhYTku7iOa_fcJFvJCQKWPjSoXTARmkMIkETZ7u0/edit?usp=sharing

[3] Natural Earth. (n.d.). Natural Earth: Free vector and raster map data. Retrieved November 14, 2025, from https://www.naturalearthdata.com/

## Language model disclosure
This file, `readme.md`, was written with the assistance of OpenAI's GPT-5 through the GitHub Copilot interface.