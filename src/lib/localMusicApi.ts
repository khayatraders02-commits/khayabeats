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

const JUNK_PATTERNS = [
  /slowed/i,
  /sped\s*up/i,
  /remix/i,
  /cover/i,
  /live/i,
  /reaction/i,
  /instrumental/i,
  /karaoke/i,
  /8d/i,
  /fan\s*made/i,
  /nightcore/i,
];

const STOP_WORDS = new Set(['official', 'audio', 'video', 'lyrics', 'song', 'music', 'the', 'a', 'an', 'and', '&']);

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const fromSlug = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/\(official[^)]*\)/gi, '')
    .replace(/\[(official|lyrics?|hd|4k|audio|video)[^\]]*\]/gi, '')
    .replace(/[–—-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const significantWords = (query: string) =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

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

const rankTracks = (query: string, tracks: Track[]): Track[] => {
  const words = significantWords(query);

  const filtered = tracks.filter((track) => {
    const text = `${track.title} ${track.artist}`;
    if (JUNK_PATTERNS.some((pattern) => pattern.test(text))) return false;
    if (words.length === 0) return true;
    const lower = text.toLowerCase();
    const matchCount = words.filter((w) => lower.includes(w)).length;
    return matchCount >= Math.min(2, words.length);
  });

  const dedupedMap = new Map<string, Track>();
  for (const track of filtered) {
    const key = `${normalizeTitle(track.title)}::${track.artist.toLowerCase()}`;
    if (!dedupedMap.has(key)) dedupedMap.set(key, track);
  }

  return Array.from(dedupedMap.values());
};

const deriveArtists = (tracks: Track[]): ArtistSearchResult[] => {
  const counts = new Map<string, { name: string; score: number; image?: string }>();

  tracks.forEach((track, idx) => {
    const name = track.artist || 'Unknown Artist';
    const key = name.toLowerCase();
    const current = counts.get(key) || { name, score: 0, image: track.thumbnailUrl };
    current.score += Math.max(1, 20 - idx);
    if (!current.image && track.thumbnailUrl) current.image = track.thumbnailUrl;
    counts.set(key, current);
  });

  return Array.from(counts.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((a) => ({ id: toSlug(a.name), name: a.name, image: a.image }));
};

const fetchITunesAlbums = async (query: string): Promise<AlbumSearchResult[]> => {
  try {
    const res = await withTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=8`, 12000);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((album: any) => ({
      id: String(album.collectionId),
      title: album.collectionName,
      artist: album.artistName,
      coverImage: album.artworkUrl100?.replace('100x100bb', '600x600bb'),
      releaseDate: album.releaseDate,
    }));
  } catch {
    return [];
  }
};

export const searchMusicCatalog = async (query: string): Promise<SearchCatalogResponse> => {
  const res = await withTimeout(`${LOCAL_SERVER_URL}/search?q=${encodeURIComponent(query)}&limit=60`);
  if (!res.ok) throw new Error('Local server search failed');

  const data = await res.json();
  const songs = rankTracks(query, (data.results || data.songs || []).map(mapTrack)).slice(0, 30);
  const artists = (data.artists && data.artists.length > 0 ? data.artists : deriveArtists(songs)).slice(0, 5);
  const albums = data.albums && data.albums.length > 0 ? data.albums : await fetchITunesAlbums(query);

  return { artists, songs, albums };
};

export const getArtistProfile = async (artistId: string, artistNameHint?: string): Promise<ArtistProfileResponse> => {
  const artistName = artistNameHint || fromSlug(artistId);

  const [songsData, artistRes, albumsRes] = await Promise.all([
    searchMusicCatalog(`${artistName} official songs`),
    withTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=musicArtist&limit=1`, 12000).catch(() => null),
    withTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=album&limit=24`, 12000).catch(() => null),
  ]);

  const artistJson = artistRes && artistRes.ok ? await artistRes.json() : { results: [] };
  const artist = artistJson.results?.[0];

  const albumsJson = albumsRes && albumsRes.ok ? await albumsRes.json() : { results: [] };
  const albumItems = (albumsJson.results || []).map((album: any) => ({
    id: String(album.collectionId),
    title: album.collectionName,
    artist: album.artistName,
    coverImage: album.artworkUrl100?.replace('100x100bb', '600x600bb'),
    releaseDate: album.releaseDate,
  }));

  const singles = albumItems.filter((a: any) => /single/i.test(a.title)).slice(0, 8);
  const albums = albumItems.filter((a: any) => !/single/i.test(a.title)).slice(0, 12);

  return {
    id: artistId,
    name: artist?.artistName || artistName,
    image: songsData.songs[0]?.thumbnailUrl,
    bannerImage: songsData.songs[0]?.thumbnailUrl,
    bio: artist ? `${artist.artistName} profile generated from live catalog data.` : `${artistName} profile generated from live catalog data.`,
    genres: artist?.primaryGenreName ? [artist.primaryGenreName] : [],
    monthlyListeners: Math.floor((songsData.songs.length || 1) * 125000),
    topSongs: songsData.songs.filter((s) => s.artist.toLowerCase().includes(artistName.toLowerCase().split(' ')[0])).slice(0, 20),
    albums,
    singles,
  };
};
