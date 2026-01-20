# KhayaBeats 🎵

A modern, production-ready music streaming app built with React, TypeScript, and Capacitor for Android/iOS deployment.

![KhayaBeats](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Android%20%7C%20iOS-green.svg)

## ✨ Features

- 🎵 **Music Streaming** - Search and play millions of songs
- 📝 **Synced Lyrics** - Real-time synchronized lyrics display
- 🎨 **Beautiful UI** - Spotify-inspired dark theme with smooth animations
- 📊 **Stats & Analytics** - View your top songs, artists, and listening time
- 🎲 **Smart Shuffle** - AI-powered playlist based on your taste
- 👥 **Jam Sessions** - Listen together with friends in real-time
- 💬 **Messaging** - Chat with friends and share what you're listening to
- 📥 **Offline Downloads** - Save songs for offline playback
- 📱 **Cross-Platform** - Works on Web, Android, and iOS

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **Animations**: Framer Motion
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Mobile**: Capacitor for native Android/iOS
- **Build Tool**: Vite

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) or [bun](https://bun.sh/)
- [Git](https://git-scm.com/)

**For Android Development:**
- [Android Studio](https://developer.android.com/studio) (with Android SDK)
- [Java JDK 17+](https://adoptium.net/)

**For iOS Development (macOS only):**
- [Xcode](https://developer.apple.com/xcode/) (latest version)
- macOS 12 or later

## 🚀 Quick Start (Web)

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/khayabeats.git
cd khayabeats
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
bun install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

> **Note**: If you're using Lovable Cloud, these are automatically configured.

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 📱 Building the Android APK

### Step 1: Install Android Development Tools

1. **Download Android Studio** from https://developer.android.com/studio
2. **Install Android SDK** (minimum SDK 22, target SDK 34)
3. **Set up environment variables**:

```bash
# Add to ~/.bashrc or ~/.zshrc (Linux/Mac)
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools

# Windows (System Environment Variables)
ANDROID_HOME = C:\Users\YOUR_USER\AppData\Local\Android\Sdk
```

### Step 2: Add Android Platform

```bash
# Add Android platform to Capacitor
npx cap add android
```

### Step 3: Build the Web App

```bash
npm run build
```

### Step 4: Sync with Native Project

```bash
npx cap sync android
```

### Step 5: Open in Android Studio

```bash
npx cap open android
```

### Step 6: Build APK in Android Studio

1. Open Android Studio (it will open automatically)
2. Wait for Gradle sync to complete
3. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
4. The APK will be generated at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Step 7: Build Release APK (For Distribution)

1. Generate a signing key:
   ```bash
   keytool -genkey -v -keystore khayabeats-release.keystore -alias khayabeats -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `android/key.properties`:
   ```properties
   storePassword=YOUR_STORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=khayabeats
   storeFile=../khayabeats-release.keystore
   ```

3. Build signed APK:
   - In Android Studio: **Build → Generate Signed Bundle/APK**
   - Select APK → Choose your keystore → Build

## 📱 Building for iOS

> **Note**: iOS builds require macOS with Xcode installed.

### Step 1: Add iOS Platform

```bash
npx cap add ios
```

### Step 2: Build and Sync

```bash
npm run build
npx cap sync ios
```

### Step 3: Open in Xcode

```bash
npx cap open ios
```

### Step 4: Configure Signing

1. In Xcode, select your project in the navigator
2. Go to **Signing & Capabilities**
3. Select your development team
4. Xcode will automatically manage signing

### Step 5: Build and Run

1. Select a simulator or connected device
2. Press **Cmd + R** to build and run

## 🔧 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Lint code
npm run lint

# Sync Capacitor after code changes
npx cap sync

# Run on Android device/emulator
npx cap run android

# Run on iOS simulator
npx cap run ios

# Live reload on device (during development)
npm run dev
# Then in another terminal:
npx cap run android -l --external
```

## 📁 Project Structure

```
khayabeats/
├── android/              # Android native project
├── ios/                  # iOS native project
├── public/               # Static assets
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── Player.tsx   # Music player
│   │   ├── QueueView.tsx
│   │   └── ...
│   ├── contexts/        # React contexts
│   ├── hooks/           # Custom hooks
│   ├── pages/           # Page components
│   ├── types/           # TypeScript types
│   └── lib/             # Utilities
├── supabase/
│   ├── functions/       # Edge functions
│   └── config.toml      # Supabase config
├── capacitor.config.ts  # Capacitor config
└── package.json
```

## 🔑 API Keys & Secrets

The app requires the following secrets (configured in Supabase):

| Secret | Description |
|--------|-------------|
| `YOUTUBE_API_KEY` | For searching music (optional) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | For edge functions |

## 🐛 Troubleshooting

### Common Issues

**Build fails with "SDK not found"**
```bash
# Make sure ANDROID_HOME is set correctly
echo $ANDROID_HOME
# Should output your SDK path
```

**Capacitor sync fails**
```bash
# Clear and reinstall
rm -rf node_modules
npm install
npx cap sync
```

**App crashes on launch**
- Check Android Studio's Logcat for error messages
- Ensure all environment variables are set
- Try clearing app data and reinstalling

**Audio not playing**
- This is normal during development with hot reload
- Build a full APK for proper audio playback

## 📞 Contact & Support

- **Phone**: +27 61 939 1305
- **Alternative**: +27 69 458 1417  
- **WhatsApp**: Available on both numbers
- **Email**: khayatraders02@gmail.com

## 📄 License

This project is private and proprietary. All rights reserved.

---

Built with ❤️ using [Lovable](https://lovable.dev)