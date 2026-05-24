# Installation Guide

Complete setup instructions for PiClock — from clone to running, on both a development machine and a Raspberry Pi.

---

## Requirements

### Node.js

- **Node.js** v18 or higher
- **npm** v9 or higher

Check your versions:

```bash
node --version
npm --version
```

### System dependencies (Linux / Raspberry Pi only)

```bash
sudo apt update
sudo apt install mpg123 ffmpeg alsa-utils
```

| Package | Used for |
|---|---|
| `mpg123` | Playing `.mp3` alarm files |
| `aplay` (alsa-utils) | Playing `.ogg` / `.wav` alarm files |
| `ffmpeg` | Song Highlights analysis (optional, only needed if highlights mode is enabled) |

> **Windows:** alarms fall back to the system default player (`cmd /c start`). This works for development, but the audio loop cannot be interrupted via SIGTERM — stop/snooze will not work correctly. Use Linux for full functionality.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/patreekp/piclock.git
cd piclock
```

### 2. Install Node dependencies

```bash
npm install
```

This generates the `node_modules` folder locally. It takes a minute on a Raspberry Pi — be patient.

### 3. Prepare an audio folder

Create a folder and add your alarm audio files (`.mp3`, `.ogg`, or `.wav`):

```bash
mkdir -p /media/alarms
cp ~/your-music/*.mp3 /media/alarms/
```

The default path is `/media/alarms`. You can change it later from the Settings page inside the app.

---

## Running the app

PiClock has two separate processes that must both be running.

### Terminal 1 — Backend

```bash
npm run server
```

Starts the Express server on `http://localhost:3000`.

On first run, the server automatically creates the SQLite database file (`raspiclockdb.sqlite`) in the project root with default configuration values.

### Terminal 2 — Frontend

```bash
npm run dev
```

Starts the Vite dev server on `http://localhost:8080`.

All `/api/*` requests are proxied to the backend automatically via Vite's dev proxy — no extra configuration needed.

### Open the app

Navigate to **`http://localhost:8080`** in your browser (or in the Raspberry Pi's browser if running locally on the device).

---

## Initial configuration

On first launch, swipe to the last page (**Settings**) and review the following:

| Setting | Default | Notes |
|---|---|---|
| Latitude | `44.0594` | Used for weather and auto theme (sunrise/sunset) |
| Longitude | `12.5683` | |
| Timezone | `Europe/Rome` | IANA format, e.g. `America/New_York`, `Europe/London` |
| Audio folder | `/media/alarms` | Absolute path to your `.mp3`/`.ogg`/`.wav` files |
| Snooze duration | `1 min` | Choose between 1, 5, or 10 minutes |
| Song Highlights | `Off` | Set to `Local` to enable ffmpeg analysis |

All settings are persisted immediately to the SQLite database — no save button needed.

---

## Raspberry Pi deployment

### Transferring files

**Do not copy `node_modules`** — it is large (~300 MB) and must be rebuilt natively on the Pi.

**Option A — rsync** (recommended):

```bash
rsync -av \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.sqlite' \
  ./piclock/ pi@raspberrypi.local:/home/pi/piclock/
```

**Option B — tar + scp:**

```bash
# On your machine
tar --exclude='./node_modules' --exclude='./.git' -czf piclock.tar.gz -C . .
scp piclock.tar.gz pi@raspberrypi.local:/home/pi/

# On the Raspberry Pi
cd /home/pi
mkdir piclock && tar -xzf piclock.tar.gz -C piclock/
```

### Install on the Pi

```bash
cd /home/pi/piclock

# System dependencies
sudo apt update
sudo apt install mpg123 ffmpeg alsa-utils

# Node dependencies (rebuilt natively on the Pi)
npm install
```

### Production build

Before building, open `vite.config.ts` and remove the `dyadComponentTagger` plugin if present — it is a development-only tool.

Then, uncomment line from 50 to 53 in `server/index.js`
```
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, '../dist')));
```

Finally, run  
```bash
npm run build
```

And frontend will be reachable from `http://localhost:8080`

Static files are output to `dist/`. The Express backend can serve them directly, or you can use nginx as a reverse proxy.

### Auto-start with PM2

Install PM2 to keep PiClock running after reboots:

```bash
sudo npm install -g pm2

# Start both processes
pm2 start "npm run server" --name piclock-server
pm2 start "npm run dev" --name piclock-frontend

# Or, if using the production build served by Express:
# pm2 start "npm run server" --name piclock

# Save and enable autostart
pm2 save
pm2 startup
```

---

## Project structure

```
piclock/
├── server/
│   ├── index.js                         # Express entry point
│   ├── db/database.js                   # SQLite init and schema
│   └── features/
│       ├── clock/clockRouter.js
│       ├── weather/weatherRouter.js + weatherService.js
│       ├── todos/todoRouter.js
│       ├── alarms/alarmRouter.js + alarmService.js
│       ├── audio/audioRouter.js + audioLibraryService.js
│       └── config/configRouter.js
├── src/
│   ├── App.tsx
│   ├── store/useAppStore.ts              # Global Zustand store
│   ├── components/
│   │   ├── PageCarousel.tsx             # Swipe navigation + auto theme logic
│   │   └── ui-themed.tsx               # ThemedButton, ThemedSwitch, ThemedToggleGroup
│   └── features/
│       ├── clock/ClockPage.tsx
│       ├── weather/WeatherPage.tsx
│       ├── todos/TodosPage.tsx
│       ├── alarms/AlarmsPage.tsx + AlarmModal.tsx
│       └── settings/SettingsPage.tsx
├── raspiclockdb.sqlite                   # Auto-generated on first run
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## API reference

### Config

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/config` | Read all configuration values |
| `PUT` | `/api/config` | Update one or more configuration values |

### Weather

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/weather` | Current conditions and 5-day forecast (cached 10 min) |

### To-dos

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/todos` | List all todos |
| `POST` | `/api/todos` | Create a todo |
| `PUT` | `/api/todos/:id` | Update a todo |
| `DELETE` | `/api/todos/:id` | Delete a todo |

### Alarms

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/alarms` | List all alarms |
| `POST` | `/api/alarms` | Create an alarm |
| `PUT` | `/api/alarms/:id` | Update an alarm |
| `DELETE` | `/api/alarms/:id` | Delete an alarm |
| `POST` | `/api/alarms/:id/stop` | Stop the currently ringing alarm |
| `POST` | `/api/alarms/:id/snooze` | Snooze the currently ringing alarm |
| `GET` | `/api/alarms/events` | SSE stream — `alarm:triggered`, `alarm:stopped` |

### Audio library

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/audio/status` | Library scan status (total, scanned, pending) |
| `POST` | `/api/audio/scan` | Start a scan (`{ onlyNew: true/false }`) |
| `POST` | `/api/audio/scan/stop` | Cancel an in-progress scan |
| `GET` | `/api/audio/events` | SSE stream — scan progress and errors |

---

## Architecture notes

**Theme colors** — Always use `var(--color-fg)` / `var(--color-bg)` for inline style overrides. Never use Tailwind classes like `bg-current text-background` — they do not resolve correctly with the e-paper-style theme system.

**UI components** — Always use the components in `ui-themed.tsx` (`ThemedSwitch`, `ThemedToggleGroup`, `ThemedButton`) for interactive controls. Do not use raw shadcn/ui components for these — they will not follow the theme correctly.

**SSE streams** — The app uses two separate SSE endpoints: `/api/alarms/events` for alarm triggers, and `/api/audio/events` for library scan progress. Both are consumed by the frontend and kept alive with a 25-second heartbeat.

**Song Highlights** — When enabled (`Local` mode), ffmpeg analyzes each audio file using ebur128 loudness measurement and stores the top-3 peak timestamps in SQLite. The first alarm play of the day starts from the loudest moment; subsequent plays start from the beginning. Requires `ffmpeg` to be installed on the system.

**Auto theme** — `PageCarousel` recalculates sunrise/sunset every minute using the NOAA solar formula with the configured latitude/longitude. No external API call is made for this.

**node_modules on Pi** — Always run `npm install` directly on the Raspberry Pi after transferring files. Some native Node.js packages (like `better-sqlite3`) must be compiled for the target architecture.