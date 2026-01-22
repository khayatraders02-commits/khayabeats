# KhayaBeats 🎵

A modern, production-ready music streaming app built with React, TypeScript, and Capacitor.

## 🚀 Quick Start

```bash
# 1. Clone and enter the project folder
git clone https://github.com/YOUR_USERNAME/khayabeats.git
cd khayabeats

# 2. Install dependencies (run this in the root folder)
npm install

# 3. Start development server
npm run dev
```

The app runs at `http://localhost:5173`

## 📁 Project Structure

```
khayabeats/                 ← ROOT FOLDER (run npm install HERE)
├── src/                    ← Main source code
│   ├── components/         ← React components (Player, Search, etc.)
│   ├── contexts/           ← React contexts (Auth, Player)
│   ├── hooks/              ← Custom hooks (useSleepTimer, etc.)
│   ├── pages/              ← Page components
│   ├── assets/             ← Images and assets
│   └── lib/                ← Utilities
├── supabase/
│   └── functions/          ← Backend edge functions
├── public/                 ← Static files
├── package.json            ← Dependencies (DON'T EDIT MANUALLY)
└── capacitor.config.ts     ← Mobile app config
```

## 📱 Build Android APK

```bash
# 1. Build web app
npm run build

# 2. Add Android platform (first time only)
npx cap add android

# 3. Sync changes
npx cap sync android

# 4. Open in Android Studio
npx cap open android

# 5. In Android Studio: Build → Build APK
# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

## ✨ Features

- 🎵 Music streaming with multiple fallback sources
- 📝 Synced lyrics (LRCLIB)
- 😴 Sleep timer
- 🎚️ Audio quality settings
- 👥 Jam sessions & messaging
- 📥 Offline downloads

## 📞 Contact

- **Phone**: +27 61 939 1305 / +27 69 458 1417
- **Email**: khayatraders02@gmail.com

---
Built with ❤️ using [Lovable](https://lovable.dev)
