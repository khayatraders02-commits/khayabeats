# KHAYABEATS Desktop Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron electron/main.js\"",
    "electron:build": "npm run build && electron-builder --win --x64",
    "electron:forge": "npm run build && electron-forge make",
    "electron:start": "electron electron/main.js"
  }
}
```

## Building the Windows App

### Option 1: Using Electron Builder (Recommended)

1. Install dependencies:
```bash
npm install --save-dev electron electron-builder concurrently wait-on
```

2. Build:
```bash
npm run electron:build
```

Output: `dist/KHAYABEATS Setup.exe`

### Option 2: Using Electron Forge

1. Install dependencies:
```bash
npm install --save-dev @electron-forge/cli @electron-forge/maker-squirrel @electron-forge/maker-zip
```

2. Build:
```bash
npm run electron:forge
```

Output: `out/make/squirrel.windows/x64/KHAYABEATS-Setup.exe`

## Development Mode

```bash
# Start dev server and electron together
npm run electron:dev
```

## Manual Build Steps

1. Build the React app:
```bash
npm run build
```

2. Package with Electron:
```bash
npx electron-builder --win --x64
```

Or with Forge:
```bash
npx electron-forge package
npx electron-forge make
```
