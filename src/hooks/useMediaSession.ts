import { useEffect } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';

/**
 * MediaSession API integration for lock-screen / notification media controls.
 * Works on Android (Chrome, Capacitor WebView), desktop browsers, etc.
 */
export const useMediaSession = () => {
  const { currentTrack, isPlaying, togglePlay, next, previous, seek, duration, progress } = usePlayer();

  // Update metadata when track changes
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: 'KhayaBeats',
      artwork: currentTrack.thumbnailUrl
        ? [
            { src: currentTrack.thumbnailUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: currentTrack.thumbnailUrl, sizes: '128x128', type: 'image/jpeg' },
            { src: currentTrack.thumbnailUrl, sizes: '192x192', type: 'image/jpeg' },
            { src: currentTrack.thumbnailUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: currentTrack.thumbnailUrl, sizes: '384x384', type: 'image/jpeg' },
            { src: currentTrack.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    });
  }, [currentTrack?.videoId, currentTrack?.title, currentTrack?.artist, currentTrack?.thumbnailUrl]);

  // Update playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Update position state
  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration || !isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1,
        position: Math.min(progress, duration),
      });
    } catch {
      // Some browsers don't support setPositionState
    }
  }, [progress, duration]);

  // Register action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => togglePlay()],
      ['pause', () => togglePlay()],
      ['previoustrack', () => previous()],
      ['nexttrack', () => next()],
      ['seekto', (details) => {
        if (details.seekTime !== undefined) seek(details.seekTime);
      }],
      ['seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        seek(Math.max(0, progress - skipTime));
      }],
      ['seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        seek(Math.min(duration, progress + skipTime));
      }],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action not supported
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, [togglePlay, next, previous, seek, progress, duration]);
};
