export interface Track {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: string;
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  tracks: Track[];
  createdAt: Date;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  queue: Track[];
  queueIndex: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
}

export interface LyricsLine {
  time: number;
  text: string;
}

export interface SearchResult {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: string;
}
