import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';
import { usePlayer } from '@/contexts/PlayerContext';

export const useBackgroundAudio = () => {
  const { isPlaying, currentTrack } = usePlayer();

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const setup = async () => {
      try {
        await BackgroundMode.enable({
          title: 'KhayaBeats',
          text: currentTrack ? `${currentTrack.title} • ${currentTrack.artist}` : 'Playing music',
          silent: false,
          resume: true,
          hidden: false,
        } as any);
      } catch {
        // plugin can fail in web preview; ignore
      }
    };

    const teardown = async () => {
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
    if (Capacitor.getPlatform() !== 'android') return;

    const listener = App.addListener('appStateChange', async ({ isActive }) => {
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

    return () => {
      listener.then((l) => l.remove()).catch(() => undefined);
    };
  }, [isPlaying, currentTrack?.title, currentTrack?.artist]);
};
