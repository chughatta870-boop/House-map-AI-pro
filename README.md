# HouseMap AI Pro 🏠

AI-powered professional house floor plan (naksha) designer — a full PWA, installable on mobile.

## Features
- Plot size input (feet) + main door direction (N/S/E/W)
- Select required rooms (bedrooms, bathrooms, kitchen, drawing room, etc.)
- AI Layout Engine (`ai.js`) auto-generates a proportioned floor plan using a guillotine-cut space-partitioning algorithm based on standard architectural room-size norms
- Blueprint-style canvas rendering (`canvas.js`): walls, doors with swing arcs, dimensions, grid, north arrow, title block
- "New Variation" button to regenerate an alternate layout
- Undo, Reset, Save/Load plans (localStorage)
- Export to PNG and PDF (with room schedule table) — `export.js`
- Fully offline-capable PWA with service worker + installable manifest
- Score target: 45/45 on PWABuilder

## Deploy to GitHub Pages
1. Create a new GitHub repo, e.g. `HouseMap-AI-Pro`.
2. Upload all files keeping the **flat structure** (index.html, icons/ folder, etc. all at repo root — do not nest in a subfolder).
3. Go to repo **Settings → Pages → Source → Deploy from branch → main / (root)**.
4. Your app will be live at:
   `https://<your-username>.github.io/HouseMap-AI-Pro/`
5. Open that URL on your phone → browser menu → **"Add to Home Screen" / Install App**.

## Convert to TWA (Android APK) via PWABuilder
1. Go to https://www.pwabuilder.com
2. Paste your GitHub Pages URL and analyze.
3. Fix any manifest/service worker warnings shown (icons and SW are already included here).
4. Click **Package for Stores → Android** to generate the TWA APK/AAB.

## File Structure
```
HouseMap-AI-Pro/
├── index.html      — App shell / UI markup
├── style.css        — Blueprint-themed professional styling
├── script.js         — Main UI controller, event wiring, install prompt
├── planner.js        — Professional Layout Engine (state management)
├── canvas.js          — Drawing Engine (renders the floor plan)
├── ai.js               — AI Layout Rules (room placement algorithm)
├── export.js            — PDF & PNG export
├── manifest.json          — PWA manifest
├── sw.js                   — Service worker (offline cache)
└── icons/                    — App icons (72–512px + maskable)
```

— Developed by M Ijaz, GHS 124/NB
