export interface Track {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: string;
  album?: string;
  isDownloaded?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  trackCount?: number;
  tracks?: Track[];
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
  tracks: Track[];
  hasMore: boolean;
  nextPageToken?: string;
}

export interface DownloadedTrack extends Track {
  audioBlob: Blob;
  downloadedAt: Date;
}
