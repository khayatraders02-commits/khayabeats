import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.khayabeats',
  appName: 'KhayaBeats',
  webDir: 'dist',
  server: {
    url: 'https://6abb415d-48b6-4355-8a5d-3186a7daeb44.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    // Enable background audio
    BackgroundRunner: {
      label: 'com.khayabeats.background.audio',
      src: 'background-audio.js',
      event: 'audioSync',
      repeat: true,
      interval: 60,
      autoStart: true,
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1a1a2e',
    // Ensure 64-bit builds
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  ios: {
    backgroundColor: '#1a1a2e',
    contentInset: 'automatic',
  },
};

export default config;
