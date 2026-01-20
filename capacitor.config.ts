import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.khayabeats',
  appName: 'KhayaBeats',
  webDir: 'dist',
  server: {
    url: 'https://6abb415d-48b6-4355-8a5d-3186a7daeb44.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
