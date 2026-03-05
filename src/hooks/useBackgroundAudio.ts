import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePlayer } from '@/contexts/PlayerContext';

export const useBackgroundAudio = () => {
  const { isPlaying, currentTrack } = usePlayer();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let BackgroundMode: any = null;
    let AppPlugin: any = null;

    const loadPlugins = async () => {
      try {
        const bgModule = await import('@anuradev/capacitor-background-mode');
        BackgroundMode = bgModule.BackgroundMode;
      } catch {
        // Plugin not available in web
      }
      try {
        const appModule = await import('@capacitor/app');
        AppPlugin = appModule.App;
      } catch {
        // Plugin not available
      }
    };

    const setup = async () => {
      await loadPlugins();
      if (!BackgroundMode) return;

      try {
        await BackgroundMode.enable({
          title: 'KhayaBeats',
          text: currentTrack ? `${currentTrack.title} • ${currentTrack.artist}` : 'Playing music',
          silent: false,
          resume: true,
          hidden: false,
        } as any);
      } catch {
        // ignore
      }
    };

    const teardown = async () => {
      if (!BackgroundMode) return;
      try {
        await BackgroundMode.disable();
      } catch {
        // ignore
      }
    };

    if (isPlaying) {
      setup();
    } else {
      teardown();
    }

    return () => {
      if (!isPlaying) teardown();
    };
  }, [isPlaying, currentTrack?.title, currentTrack?.artist]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const { BackgroundMode } = await import('@anuradev/capacitor-background-mode');

        const listener = await App.addListener('appStateChange', async ({ isActive }) => {
          if (!isActive && isPlaying) {
            try {
              await BackgroundMode.enable({
                title: 'KhayaBeats',
                text: currentTrack ? `${currentTrack.title} • ${currentTrack.artist}` : 'Playing music',
                silent: false,
                resume: true,
                hidden: false,
              } as any);
            } catch {
              // ignore
            }
          }
        });

        cleanup = () => listener.remove();
      } catch {
        // Plugins not available in web
      }
    };

    setupListener();

    return () => {
      cleanup?.();
    };
  }, [isPlaying, currentTrack?.title, currentTrack?.artist]);
};
