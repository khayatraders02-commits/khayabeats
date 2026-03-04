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

export interface ArtistProfile {
  id: string;
  name: string;
  bio?: string;
  profileImage?: string;
  bannerImage?: string;
  genres?: string[];
  monthlyListeners?: number;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  coverImage?: string;
  releaseDate?: string;
}

export interface SearchCatalog {
  artists: ArtistProfile[];
  songs: Track[];
  albums: Album[];
}
