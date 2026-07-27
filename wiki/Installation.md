# Installation Guide
 
Complete setup instructions for PiClock — from clone to running, on both a development machine and a Raspberry Pi.
 
---
 
## Requirements
 
### Node.js

- **Node.js** v20 or higher (v22 LTS recommended — some dependencies, including Vite 8 and better-sqlite3's native build, require it)
- **npm** v9 or higher

The project pins its recommended version in `.nvmrc`. If you use [nvm](https://github.com/nvm-sh/nvm):

```bash
# install nvm (skip if already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# restart your terminal, then:
nvm install
nvm use
```

Otherwise, check your versions manually:

```bash
node --version
npm --version
```

> **Node 18 will not work correctly.** `npm install` will succeed but emit `EBADENGINE` warnings, and `better-sqlite3`'s native binding may be compiled against the wrong ABI, causing runtime errors when the server starts. If you're upgrading an existing checkout from Node 18, delete and rebuild native modules after switching:
> ```bash
> rm -rf node_modules package-lock.json
> npm install --legacy-peer-deps
> ```
 V
### System dependencies (Linux / Raspberry Pi only)
 
```bash
sudo apt update
sudo apt install mpg123 ffmpeg alsa-utils avahi-daemon
```
 
| Package | Used for |
|---|---|
| `mpg123` | Playing `.mp3` alarm files |
| `aplay` (alsa-utils) | Playing `.ogg` / `.wav` alarm files |
| `ffmpeg` | Song Highlights analysis (optional, only needed if highlights mode is enabled) |
| `avahi-daemon` | mDNS — makes the Pi reachable as `piclock.local` on the local network (usually pre-installed on Raspberry Pi OS) |
 
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

> On first install (or after switching Node versions), `better-sqlite3` compiles a native binding from source — this can take several minutes, longer than a typical `npm install`. This is expected.
 
> **Peer dependency conflict:** `vaul` (used by shadcn/ui for drawers/bottom-sheets) declares support for React ≤18 only, while this project uses React 19. If `npm install` fails with an `ERESOLVE` error mentioning `vaul`, run instead:
> ```bash
> npm install --legacy-peer-deps
> ```
> This is expected and safe — React 19 is simply newer than what `vaul`'s peer dependency range has been updated to reflect, but it works fine in practice. If you run this, commit the updated `package-lock.json` so future installs (including on the Pi) don't hit the same error.
 
### 3. Prepare an audio folder
 
Create a folder and add your alarm audio files (`.mp3`, `.ogg`, or `.wav`):
 
```bash
mkdir -p /media/alarms
cp ~/your-music/*.mp3 /media/alarms/
```
 
The default path is `/media/alarms`. You can change it later from the Settings page inside the app.
 
---
 
## Running the app (development)
 
PiClock has two separate processes that must both be running in dev mode.
 
### Environment variables (optional)

The backend defaults to port `3000` in development. On Linux, binding to port `80` (used by default in production, see the deployment section) requires elevated privileges — attempting it without them fails silently: no stacktrace, no visible error, the process appears to start (you'll even see the "server running" log line) but never actually binds, and exits on its own a few seconds later once its internal boot timers finish.

To avoid this, the project supports a local `.env` file using Node's native `--env-file` flag (Node ≥20.6, no `dotenv` dependency needed):

```bash
cp .env.example .env
# edit .env if you need a port other than 3000
```

Then start the backend with:

```bash
npm run server:dev   # equivalent to: node --env-file=.env server/index.js
```

`.env` is machine-specific and excluded from version control — `.env.example` is committed as a reference. `npm run server` (without `:dev`) remains unchanged and ignores `.env` entirely — it's intended for production on the Pi, where the port is set via systemd (`Environment=PORT=80`) instead.

> **Troubleshooting tip:** if the server seems to "shut down on its own" a few seconds after starting, with no visible error and exit code `0`, suspect a failed bind to a privileged port before looking anywhere else. Quick test: `PORT=3000 node server/index.js`.

### Terminal 1 — Backend
 
```bash
npm run server
```
 
Starts the Express server. By default it binds to port `3000` unless overridden via the `PORT` environment variable, and listens on `0.0.0.0` so it's reachable from other devices on the network, not just `localhost`.
 
On first run, the server automatically creates the SQLite database file (`piclockdb.sqlite`) in the project root with default configuration values.
 
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
sudo apt install mpg123 ffmpeg alsa-utils avahi-daemon
 
# Node dependencies (rebuilt natively on the Pi)
npm install
```
 
### Production build
 
Before building, open `vite.config.ts` and remove the `dyadComponentTagger` plugin if present — it is a development-only tool.
 
`server/index.js` already serves the production build from `dist/` and falls back to `index.html` for client-side routing — no manual uncommenting needed.
 
Then run:
 
```bash
npm run build
```
 
Static files are output to `dist/`. The Express backend serves them directly on the same origin as the API (no separate frontend process, no CORS to configure).
 
### Making the Pi reachable on the local network
 
By default the server binds to `0.0.0.0` on port `80`, so once running it's reachable from any device on the same network — no port required in the URL.
 
Binding to port 80 requires elevated privileges. Instead of running the whole process as root, grant Node the specific capability to bind privileged ports:
 
```bash
sudo setcap 'cap_net_bind_service=+ep' $(which node)
```
 
Verify it worked:
 
```bash
getcap $(which node)
# expected: /usr/bin/node cap_net_bind_service=ep
```
 
> Re-run this command whenever the Node binary changes (Node version upgrade, nvm switch, `apt upgrade`, etc.) — `setcap` is tied to the specific binary file.
 
If you'd rather avoid `setcap` entirely, run the server on an unprivileged port instead:
 
```bash
PORT=3000 npm run server
```
 
In that case the app is reachable at `http://piclock.local:3000` — you'll need to include the port in the URL every time.
 
#### Set a friendly hostname (mDNS / Avahi)
 
```bash
sudo raspi-config
# System Options > Hostname > piclock
sudo reboot
```
 
Confirm Avahi is running:
 
```bash
systemctl status avahi-daemon
```
 
Once set, the Pi is reachable from any phone/PC on the same network at:
 
```
http://piclock.local
```
 
*(Any hostname works — letters, numbers, and hyphens only. It always resolves as `<hostname>.local`, not a custom TLD, unless you set up a local DNS server such as `dnsmasq`.)*
 
### Auto-start on boot (systemd)
 
Create `/etc/systemd/system/piclock.service`:
 
```ini
[Unit]
Description=PiClock Server
After=network-online.target avahi-daemon.service
Wants=network-online.target
 
[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/piclock
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
 
[Install]
WantedBy=multi-user.target
```
 
Adjust `WorkingDirectory` and `User` to match your actual path/user on the Pi. Then:
 
```bash
sudo systemctl daemon-reload
sudo systemctl enable piclock
sudo systemctl start piclock
sudo systemctl status piclock
```
 
From now on, the Pi boots → PiClock starts automatically → reachable at `http://piclock.local`, no terminal needed.
 
> **Note:** systemd replaces PM2 for this project — since there's now a single production process (Express serving both API and static build), a dedicated systemd unit with `Restart=on-failure` is simpler and doesn't require an extra global npm package. If you still prefer PM2, `pm2 start server/index.js --name piclock` works too, just remember `pm2 save && pm2 startup` to persist across reboots.
 
---
 
## Project structure
 
```
piclock/
├── server/
│   ├── index.js                         # Express entry point
│   ├── sse.js                           # Shared SSE hub — broadcast() + sseHandler, mounted at /api/events
│   ├── db/database.js                   # SQLite init and schema
│   └── features/
│       ├── clock/clockRouter.js
│       ├── weather/weatherRouter.js + weatherService.js
│       ├── todos/todoRouter.js
│       ├── alarms/alarmRouter.js + alarmService.js
│       ├── audio/audioRouter.js + audioLibraryService.js
│       ├── pomodoro/pomodoroRouter.js + pomodoroService.js
│       ├── remote/remoteRouter.js + remoteService.js
│       ├── config/configRouter.js
│       └── system/systemRouter.js
├── src/
│   ├── App.tsx
│   ├── lib/
│   │   └── sseHub.ts                    # Shared EventSource singleton, consumed by all stores
│   ├── store/
│   │   ├── useAppStore.ts               # Global Zustand store (config, theme, language, page slug, remote nav)
│   │   └── usePomodoroStore.ts          # Pomodoro timer state, SSE connection, remote actions
│   ├── components/
│   │   ├── PageCarousel.tsx             # Swipe navigation + auto theme + remote-navigate listener
│   │   └── ui-themed.tsx               # ThemedButton, ThemedSwitch, ThemedToggleGroup
│   ├── assets/
│   │   └── sounds/bell.mp3              # Pomodoro phase-complete sound
│   └── features/
│       ├── clock/ClockPage.tsx
│       ├── weather/WeatherPage.tsx
│       ├── pomodoro/PomodoroPage.tsx
│       ├── todos/TodosPage.tsx
│       ├── alarms/AlarmsPage.tsx + AlarmModal.tsx
│       ├── remote/RemoteApp.tsx         # Companion control page, served at /remote
│       └── settings/SettingsPage.tsx
├── piclockdb.sqlite                   # Auto-generated on first run
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
| `POST` | `/api/alarms/:id/skip-next` | Toggle skip-next for an alarm |
 
### Audio library
 
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/audio/status` | Library scan status (total, scanned, pending) |
| `POST` | `/api/audio/scan` | Start a scan (`{ onlyNew: true/false }`) |
| `POST` | `/api/audio/scan/stop` | Cancel an in-progress scan |
| `GET` | `/api/audio/events` | SSE stream — scan progress and errors |
 
### Pomodoro
 
Timer state lives on the backend (in memory, not persisted), so it can be controlled from any device on the local network — not just the Pi's own touchscreen.
 
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/pomodoro/state` | Current timer state (phase, session index, status, seconds left) |
| `POST` | `/api/pomodoro/start` | Start or resume the timer; also triggers `pomodoro:navigate` |
| `POST` | `/api/pomodoro/pause` | Pause the running timer |
| `POST` | `/api/pomodoro/reset` | Reset to the beginning of the cycle |
| `POST` | `/api/pomodoro/skip` | Manually skip to the next phase (no auto-resume) |
 
---
 
### Remote control

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/remote/state` | Currently displayed page on the main screen |
| `POST` | `/api/remote/navigate` | Change the displayed page (`{ "page": "weather" }`) |

### Real-time events

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/events` | Single multiplexed SSE stream for the whole app. Named events: `alarm:triggered`, `alarm:stopped`, `alarms:changed`, `weather:updated`, `weather:error`, `pomodoro:state`, `pomodoro:phase-complete`, `pomodoro:navigate`, `todos:changed`, `remote:navigate` |
| `GET` | `/api/audio/events` | Separate stream, audio library scan progress and errors (not yet merged into `/api/events`) |

## Architecture notes
 
**Theme colors** — Always use `var(--color-fg)` / `var(--color-bg)` for inline style overrides. Never use Tailwind classes like `bg-current text-background` — they do not resolve correctly with the e-paper-style theme system.
 
**UI components** — Always use the components in `ui-themed.tsx` (`ThemedSwitch`, `ThemedToggleGroup`, `ThemedButton`) for interactive controls. Do not use raw shadcn/ui components for these — they will not follow the theme correctly.
 
**SSE streams** — All real-time events (alarms, weather updates, Pomodoro state, to-do changes, remote-control navigation) are multiplexed over a **single** endpoint, `GET /api/events`, distinguished by named SSE event types (`alarm:triggered`, `weather:updated`, `pomodoro:state`, `todos:changed`, `remote:navigate`, etc.). The audio library scan (`/api/audio/events`) is currently the only feature that still uses its own dedicated stream.

This consolidation was a deliberate fix, not the original design: browsers cap HTTP/1.1 connections to **6 per origin**, and with each feature originally opening its own long-lived `EventSource`, having both the main display and the `/remote` companion page open at once (see below) could exhaust that limit — causing pages to hang indefinitely in a loading state until one of the open tabs was closed. Server-side, `server/sse.js` exposes a shared `broadcast(event, data)` and `sseHandler`; client-side, `src/lib/sseHub.ts` exposes `onSseEvent(eventName, handler) → unsubscribe` backed by a single singleton `EventSource`. All stores (`usePomodoroStore`, `useWeatherStore`, `useTodoStore`, `useAlarmStore`, `useAppStore`) consume events through this shared hub instead of opening their own connection. Heartbeats every 25 seconds keep the single connection alive through proxies.
 
**Song Highlights** — When enabled (`Local` mode), ffmpeg analyzes each audio file using ebur128 loudness measurement and stores the top-3 peak timestamps in SQLite. The first alarm play of the day starts from the loudest moment; subsequent plays start from the beginning. Requires `ffmpeg` to be installed on the system.
 
**Auto theme** — `PageCarousel` recalculates sunrise/sunset every minute using the NOAA solar formula with the configured latitude/longitude. No external API call is made for this.
 
**Remote control (`/remote`)** — A companion page, served by the same Express backend at the `/remote` route (same origin, no separate server, no CORS). Designed for a narrow screen (phone), with always-visible page-switch buttons and a contextual control panel that changes based on whichever page is currently shown on the Pi's display: Pomodoro (start/pause/reset/skip), Weather (force refresh), Alarms (list + add/edit, reusing the same `CircularTimePicker` as the main Alarms page), and To-dos (list + add/check/delete). If an alarm is ringing, `AlarmModal` — mounted globally — takes over on `/remote` too, showing the same fullscreen stop/snooze overlay as the main display.

The underlying pattern, first proven with the Pomodoro timer, is: state lives on the server (in memory for ephemeral things like the timer or "which page is showing", SQLite for persistent things like alarms/todos), any device on the LAN can mutate it via a REST endpoint, and every connected client — Pi included — is notified via SSE and updates itself. `useAppStore.ts` identifies pages by a string slug (`PageSlug: 'clock' | 'weather' | 'pomodoro' | 'todos' | 'alarms' | 'settings'`) rather than a numeric carousel index, so `/remote` can reference pages by name without knowing the Pi's swipe order; `setPage(slug)` updates local state and notifies the server via `POST /api/remote/navigate`, and `PageCarousel` listens for the resulting `remote:navigate` SSE event to switch pages without a physical swipe. Settings is not yet controllable from `/remote`.
 
**node_modules on Pi** — Always run `npm install` directly on the Raspberry Pi after transferring files. Some native Node.js packages (like `better-sqlite3`) must be compiled for the target architecture.
 
**Network binding** — In production the server binds to `0.0.0.0` (not `localhost`) so it's reachable from any device on the LAN, and defaults to port `80` (via `setcap`, see deployment section) so the app is reachable at a clean `http://piclock.local` with no port in the URL.
 
**tsconfig.json** — Do not use the `baseUrl` compiler option; it has been removed and is rejected by recent TypeScript versions when `moduleResolution` is set to `"bundler"`. Path aliases (`"@/*": ["./src/*"]`) resolve automatically relative to the location of `tsconfig.json` without it.
 
