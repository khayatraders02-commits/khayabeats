import { useState, useEffect, useCallback } from 'react';

export type AudioQuality = 'low' | 'medium' | 'high' | 'auto';

interface AudioQualityInfo {
  label: string;
  bitrate: string;
  description: string;
}

export const AUDIO_QUALITY_OPTIONS: Record<AudioQuality, AudioQualityInfo> = {
  low: {
    label: 'Low',
    bitrate: '96 kbps',
    description: 'Saves data, lower quality',
  },
  medium: {
    label: 'Medium',
    bitrate: '160 kbps',
    description: 'Balanced quality and data',
  },
  high: {
    label: 'High',
    bitrate: '320 kbps',
    description: 'Best quality, uses more data',
  },
  auto: {
    label: 'Auto',
    bitrate: 'Variable',
    description: 'Adjusts based on connection',
  },
};

const STORAGE_KEY = 'khayabeats_audio_quality';

export const useAudioQuality = () => {
  const [quality, setQualityState] = useState<AudioQuality>(() => {
    if (typeof window === 'undefined') return 'auto';
    return (localStorage.getItem(STORAGE_KEY) as AudioQuality) || 'auto';
  });

  const setQuality = useCallback((newQuality: AudioQuality) => {
    setQualityState(newQuality);
    localStorage.setItem(STORAGE_KEY, newQuality);
  }, []);

  // Get the preferred bitrate based on quality setting
  const getPreferredBitrate = useCallback((): number => {
    switch (quality) {
      case 'low':
        return 96000;
      case 'medium':
        return 160000;
      case 'high':
        return 320000;
      case 'auto':
      default:
        // Use high quality on WiFi, medium on cellular
        if (typeof navigator !== 'undefined' && 'connection' in navigator) {
          const conn = (navigator as any).connection;
          if (conn?.effectiveType === '4g' || conn?.type === 'wifi') {
            return 320000;
          } else if (conn?.effectiveType === '3g') {
            return 160000;
          }
          return 96000;
        }
        return 320000; // Default to high if API not available
    }
  }, [quality]);

  return {
    quality,
    setQuality,
    getPreferredBitrate,
    qualityInfo: AUDIO_QUALITY_OPTIONS[quality],
  };
};
