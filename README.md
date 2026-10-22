# CPU Scheduling Lab: C++ backend + HTML/CSS/JS docs

```
cpu-scheduling-lab-cpp/
├── backend/main.cpp    scheduling engine (FCFS, SJF, SRTF, Priority NP/P, Round Robin) + HTTP server
└── docs/           index.html, css/style.css, js/app.js (UI calls POST /api/simulate)
```

## Build and run (VS Code terminal)
```
cd backend
g++ -std=c++17 -O2 main.cpp -o scheduler          # Windows MinGW: add -lws2_32
./scheduler                                       # Windows: scheduler.exe
```
Open http://localhost:8080. Optional args: `./scheduler ../docs 9000`.

Needs only a C++17 compiler (g++, clang, MSVC). Install the "C/C++" extension for IntelliSense.

## API
`POST /api/simulate` with body `algo=fcfs|sjf|srtf|pnp|pp|rr|all&q=2&procs=at,bt,pr;at,bt,pr`
Returns JSON: `seg` (Gantt segments, id null = idle), `rows` (CT/TAT/WT/RT per process), `wt`, `tat`, `rt`, `util`, `cs`, `thr`, `end`.
`algo=all` returns every algorithm keyed by name (used by Compare and Quiz).

## Live demo on GitHub Pages
The `docs/` folder is also a static site. Without the C++ server the page automatically uses an in-browser copy of the same engine (`docs/js/engine.js`), so the link works for anyone.
Enable it in Settings > Pages > Branch `main` > Folder `/docs`.
