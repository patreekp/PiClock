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
│   ├── db/database.js                   # SQLite init and schema
│   └── features/
│       ├── clock/clockRouter.js
│       ├── weather/weatherRouter.js + weatherService.js
│       ├── todos/todoRouter.js
│       ├── alarms/alarmRouter.js + alarmService.js
│       ├── audio/audioRouter.js + audioLibraryService.js
│       ├── config/configRouter.js
│       └── system/systemRouter.js
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
 
**Network binding** — In production the server binds to `0.0.0.0` (not `localhost`) so it's reachable from any device on the LAN, and defaults to port `80` (via `setcap`, see deployment section) so the app is reachable at a clean `http://piclock.local` with no port in the URL.
