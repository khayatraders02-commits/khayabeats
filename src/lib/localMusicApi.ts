import { Track } from '@/types/music';

const LOCAL_SERVER_URL = 'http://localhost:3001';

export interface ArtistSearchResult {
  id: string;
  name: string;
  image?: string;
  bio?: string;
  monthlyListeners?: number;
}

export interface AlbumSearchResult {
  id: string;
  title: string;
  artist: string;
  coverImage?: string;
  releaseDate?: string;
}

export interface SearchCatalogResponse {
  artists: ArtistSearchResult[];
  songs: Track[];
  albums: AlbumSearchResult[];
}

export interface ArtistProfileResponse {
  id: string;
  name: string;
  image?: string;
  bannerImage?: string;
  bio?: string;
  genres?: string[];
  monthlyListeners?: number;
  topSongs: Track[];
  albums: AlbumSearchResult[];
  singles: AlbumSearchResult[];
}

const mapTrack = (item: any): Track => ({
  id: item.id || item.videoId,
  videoId: item.videoId || item.id,
  title: item.title || 'Unknown Title',
  artist: item.artist || 'Unknown Artist',
  thumbnailUrl: item.thumbnailUrl || '',
  duration: item.duration || '0:00',
});

const withTimeout = async (url: string, timeoutMs = 20000) => {
  return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
};

export const searchMusicCatalog = async (query: string): Promise<SearchCatalogResponse> => {
  const res = await withTimeout(`${LOCAL_SERVER_URL}/search?q=${encodeURIComponent(query)}&limit=50`);
  if (!res.ok) throw new Error('Local server search failed');

  const data = await res.json();
  const songs = (data.songs || data.results || []).map(mapTrack);

  return {
    artists: data.artists || [],
    songs,
    albums: data.albums || [],
  };
};

export const getArtistProfile = async (artistId: string): Promise<ArtistProfileResponse> => {
  const res = await withTimeout(`${LOCAL_SERVER_URL}/artists/${encodeURIComponent(artistId)}`);
  if (!res.ok) throw new Error('Artist profile fetch failed');

  const data = await res.json();

  return {
    ...data,
    topSongs: (data.topSongs || []).map(mapTrack),
    albums: data.albums || [],
    singles: data.singles || [],
  };
};
