# KhayaBeats 🎵

A modern, production-ready music streaming app built with React, TypeScript, and Capacitor.

## 🚀 Quick Start

```bash
# 1. Clone the project from GitHub
git clone https://github.com/YOUR_USERNAME/khayabeats.git

# 2. Enter the project folder (THIS IS WHERE YOU RUN ALL COMMANDS)
cd khayabeats

# 3. Install dependencies
npm install

# 4. Start development server
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
│   ├── lib/                ← Utilities (offline storage, etc.)
│   └── types/              ← TypeScript types
├── supabase/
│   └── functions/          ← Backend edge functions
│       ├── get-audio-stream/   ← Audio streaming with fallbacks
│       ├── youtube-search/     ← Search with YouTube + Piped fallback
│       └── get-lyrics/         ← Synced lyrics from LRCLIB
├── public/                 ← Static files
├── package.json            ← Dependencies (DON'T EDIT MANUALLY)
└── capacitor.config.ts     ← Mobile app config
```

## 📱 Build Android APK (64-bit)

### Prerequisites
- Android Studio (latest version)
- Java JDK 17+
- Node.js 18+

### Build Steps

```bash
# 1. Build the web app
npm run build

# 2. Add Android platform (first time only)
npx cap add android

# 3. Sync changes to Android
npx cap sync android

# 4. Open Android Studio
npx cap open android
```

### IMPORTANT: Enable 64-bit Support

After opening in Android Studio, edit `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        // ... existing config ...
        
        ndk {
            abiFilters 'arm64-v8a', 'x86_64'
        }
    }
    
    // Ensure proper SDK versions
    compileSdkVersion 34
    
    defaultConfig {
        minSdkVersion 23
        targetSdkVersion 34
    }
}
```

### Build the APK

In Android Studio:
1. **Build → Generate Signed Bundle / APK**
2. Choose **APK**
3. Create or select a keystore
4. Select **release** build variant
5. Click **Create**

APK location: `android/app/build/outputs/apk/release/app-release.apk`

## ✨ Features

### Core Playback
- 🎵 **Music streaming** with Cobalt, Piped, and Invidious fallbacks
- 📝 **Synced lyrics** from LRCLIB (click to seek)
- 🔀 **Shuffle & Repeat** modes
- 🎚️ **Audio quality** settings (Low/Medium/High/Auto)
- ⏰ **Sleep timer** (15, 30, 45, 60, 90, 120 minutes)

### Offline & Downloads
- 📥 **Download songs** for offline playback
- 💾 **IndexedDB storage** for downloaded tracks
- 📴 **Offline mode** - play downloaded tracks without internet

### Social Features
- 👥 **Jam sessions** - listen together with friends
- 💬 **Messaging** - chat with friends in-app
- 🔗 **Friend system** - send/accept friend requests

### Mobile
- 📱 **Native mobile app** via Capacitor
- 🔔 **Push notifications** for messages & friend requests
- 🎨 **Swipeable onboarding** tutorial

## 🔧 Troubleshooting

### Songs not playing?
- Check your internet connection
- The app uses multiple fallback sources - if one fails, it tries others
- Some videos may be region-restricted

### Lyrics not syncing?
- Synced lyrics require matching track metadata
- Not all songs have synced lyrics available
- Plain lyrics will be shown if synced lyrics aren't found

### Download not working?
- Must be signed in to download
- Check available storage space
- Try a different song

### Android build issues?
- Ensure Android Studio is up to date
- Check that NDK is installed in SDK Manager
- Use Java 17 or higher

## 📞 Contact

- **Phone**: +27 61 939 1305 / +27 69 458 1417
- **Email**: khayatraders02@gmail.com
- **WhatsApp**: +27 61 939 1305

---
Built with ❤️ in South Africa using [Lovable](https://lovable.dev)
