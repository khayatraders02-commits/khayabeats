# 🎵 KHAYABEATS Desktop App - Complete Setup Guide

Build KHAYABEATS as a native Windows 10/11 desktop application.

---

## 📋 Prerequisites

1. **Node.js** (v18+) - [Download](https://nodejs.org/)
2. **Git** - [Download](https://git-scm.com/)
3. **Windows 10/11 (64-bit)**

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/khayabeats.git
cd khayabeats
npm install
```

### Step 2: Install Electron Dependencies

```bash
npm install --save-dev electron electron-builder concurrently wait-on
```

### Step 3: Add Build Scripts

Add these to your `package.json` scripts section:

```json
{
  "scripts": {
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron electron/main.js\"",
    "electron:build": "npm run build && electron-builder --win --x64",
    "electron:start": "electron electron/main.js"
  }
}
```

### Step 4: Run in Development Mode

```bash
npm run electron:dev
```

This starts both the Vite dev server AND Electron together!

---

## 📦 Building the Windows Installer

### Build the Production App

```bash
npm run electron:build
```

**Output:** `dist-electron/KHAYABEATS-Setup-1.0.0.exe`

This creates a proper Windows installer with:
- Desktop shortcut
- Start Menu shortcut
- Uninstaller
- 64-bit architecture

---

## 🔧 Configuration Files

### electron-builder.json (already created)
Controls how the Windows installer is built.

### electron/main.js
The main Electron process - handles:
- Window creation
- System tray
- Media keys
- Native menus

### electron/preload.js
Bridge between web app and native features.

---

## 🎛️ Features

### System Tray
- App minimizes to tray when closed
- Right-click for quick controls
- Double-click to restore

### Media Keys
- Play/Pause, Next, Previous
- Works globally even when app is minimized

### Offline Mode
Downloaded songs work without internet!

---

## ⚠️ Troubleshooting

### "Windows protected your PC"
Click "More info" → "Run anyway" (app isn't code-signed yet)

### Scripts not found
Make sure you added the scripts to package.json:
```bash
npm run
```
Should show `electron:dev`, `electron:build`, etc.

### Build fails
```bash
# Clear and reinstall
rm -rf node_modules dist dist-electron
npm install
npm run electron:build
```

### Missing dependencies
```bash
npm install --save-dev electron electron-builder concurrently wait-on
```

---

## 🔄 Alternative: Electron Forge

If you prefer Electron Forge:

```bash
npm install --save-dev @electron-forge/cli @electron-forge/maker-squirrel
npx electron-forge import
npx electron-forge make
```

Output: `out/make/squirrel.windows/x64/KHAYABEATS-Setup.exe`

---

## 📱 Also Available On

- **Android APK** - See mobile setup guide
- **Web Browser** - Visit the live preview

---

## 🆘 Support

- 📧 Email: khayabeats@gmail.com
- 📱 Phone: +27 61 461 7733

---

Made with ❤️ by KHAYABEATS
