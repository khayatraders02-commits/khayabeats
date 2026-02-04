# 🎵 KHAYABEATS Desktop App - Setup Guide

This guide will help you install and run KHAYABEATS as a native Windows 10/11 desktop application.

---

## 📋 Prerequisites

Before you begin, make sure you have:

1. **Node.js** (v18 or newer) - [Download here](https://nodejs.org/)
2. **Git** - [Download here](https://git-scm.com/)
3. **Windows 10/11 (64-bit)**

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Clone the Repository

Open **Command Prompt** or **PowerShell** and run:

```bash
git clone https://github.com/YOUR_USERNAME/khayabeats.git
cd khayabeats
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Install Electron Dependencies

```bash
npm install electron electron-builder --save-dev
```

### Step 4: Run the Desktop App

For development (hot-reload):
```bash
npm run electron:dev
```

For production build:
```bash
npm run electron:build
```

---

## 📦 Building the Windows Installer

To create a Windows installer (`.exe` setup wizard):

### Option A: Using Electron Forge (Recommended)

```bash
# Install Electron Forge
npm install --save-dev @electron-forge/cli @electron-forge/maker-squirrel @electron-forge/maker-zip

# Build the installer
npx electron-forge make
```

The installer will be in: `out/make/squirrel.windows/x64/KHAYABEATS-Setup.exe`

### Option B: Using Electron Builder

```bash
# Install Electron Builder
npm install electron-builder --save-dev

# Build for Windows
npx electron-builder --win
```

The installer will be in: `dist/KHAYABEATS Setup.exe`

---

## 🔧 Configuration

### App Settings

Edit `electron/main.js` to customize:

- Window size: `width`, `height`
- Minimum size: `minWidth`, `minHeight`
- App icon: `icon`
- Background color: `backgroundColor`

### Build Settings

Edit `electron/forge.config.js` to customize:

- App name and copyright
- Installer icon
- Auto-update settings
- Platform targets

---

## 🎛️ Features

### System Tray

- The app minimizes to system tray when closed
- Double-click tray icon to restore
- Right-click for quick controls (Play/Pause, Next, Previous)

### Media Keys

Global media key support:
- **Play/Pause** - Media Play/Pause key
- **Next Track** - Media Next key
- **Previous Track** - Media Previous key
- **Stop** - Media Stop key

### Offline Mode

Downloaded songs work offline! Open the app without internet to play your saved music.

---

## ⚠️ Troubleshooting

### "Windows protected your PC" message

This appears because the app isn't code-signed. Click:
1. "More info"
2. "Run anyway"

### Audio not playing

1. Check your internet connection
2. Try a different song
3. Restart the app

### App not starting

```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm run electron:dev
```

---

## 📱 Also Available On

- **Android APK** - See mobile setup guide
- **Web Browser** - Visit [khayabeats.app](https://6abb415d-48b6-4355-8a5d-3186a7daeb44.lovableproject.com)

---

## 🆘 Support

Having issues? Contact us:
- 📧 Email: [email protected]
- 📱 Phone: +27 61 461 7733

---

Made with ❤️ by KHAYABEATS
