---
description: Launch the Staked app on the iOS simulator and take a screenshot
---

# Run: Staked iOS Simulator

## Prerequisites

- Node ≥ 20.13 via nvm — always load nvm before running Expo
- iPhone 17 Pro simulator (UDID: `E53A9F4A-76FA-4FB4-AFC5-568BD301578D`) — usually already booted
- Expo Go 56 is pre-installed on that simulator

## Launch

```bash
# 1. Load nvm and switch to Node 20
source ~/.nvm/nvm.sh && nvm use 20

# 2. Start Expo dev server in the background, targeting the booted simulator
npx expo start --ios &> /tmp/expo.log &
EXPO_PID=$!

# 3. Wait until the Metro bundler is ready (polls for the manifest endpoint)
until curl -sf http://localhost:8081/ > /dev/null 2>&1; do sleep 2; done

# 4. Wait for Expo Go to open and fully load the bundle (~20-30s on first run)
until pgrep -f "Expo Go" > /dev/null; do sleep 2; done
sleep 10
```

## Navigate to a specific screen

Use the Expo deep-link URL scheme to jump to any route:

```bash
# Welcome/auth screen (shows even when demo mode is active)
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/(auth)/welcome"

# Dashboard (tabs)
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/(tabs)"

# Wait 2-3s after deep linking before screenshotting
```

## Take a screenshot

```bash
xcrun simctl io booted screenshot /tmp/staked_screen.png
```
Then use the Read tool on `/tmp/staked_screen.png` to view the result.

## Stop the dev server

```bash
kill $EXPO_PID 2>/dev/null
# or if PID was lost:
pkill -f "expo start"
```

## Notes

- **Demo mode**: `EXPO_PUBLIC_DEMO_MODE=true` in `.env` means the app boots already "signed in" with mock data. The welcome screen is only reachable via deep link in this mode.
- **First bundle**: Takes 20–30s. Subsequent hot reloads after code changes are near-instant (Metro HMR).
- **If Expo Go crashes**: Re-run `xcrun simctl openurl booted "exp://127.0.0.1:8081"` to reopen.
- **Port conflicts**: If 8081 is in use, kill the old server with `pkill -f "expo start"` before retrying.
