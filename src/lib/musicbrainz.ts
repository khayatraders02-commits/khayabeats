// MusicBrainz API for real artist images
// Uses Cover Art Archive for album art

const MB_BASE = 'https://musicbrainz.org/ws/2';
const CAA_BASE = 'https://coverartarchive.org';
const USER_AGENT = 'KhayaBeats/1.0 (khayatraders02@gmail.com)';

interface ArtistInfo {
  id: string;
  name: string;
  imageUrl: string | null;
  releaseGroupId?: string;
}

// Artist name to MusicBrainz ID mapping for common artists
// This avoids rate limiting from repeated searches
const ARTIST_MBID_CACHE: Record<string, string> = {
  'drake': '9fff2f8a-21e6-47de-a2b8-7f449929d43f',
  'the weeknd': 'c8b03190-306c-4f1e-8d30-002f46fdb09d',
  'beyoncé': '859d0860-d480-4efd-970c-c05d5f1776b8',
  'beyonce': '859d0860-d480-4efd-970c-c05d5f1776b8',
  'sza': '32a8d18e-e0c7-40ef-a1e9-0493f60d39ca',
  'summer walker': '8c1a15d9-8d77-45fc-beba-a1c51e2dd2db',
  'taylor swift': '20244d07-534f-4eff-b4d4-930878571e2f',
  'kendrick lamar': '381086ea-f511-4aba-bdf9-71c753dc5077',
  'doja cat': 'e45b8c67-5b38-4b4a-bd2c-f6f8dc59bb92',
  'travis scott': '5f1adfe1-4d07-4141-b181-79e5d379d539',
  'rihanna': '73e5e69d-3554-40d8-8516-00cb38737a1c',
  'chris brown': 'c234fa42-e6a6-443e-937e-2f4b073538a3',
  'usher': 'e0e1db18-f7ba-4dee-95ff-7ae8cf545460',
  'ed sheeran': 'b8a7c51f-362c-4dcb-a259-bc6f0c4c3cec',
  'ariana grande': 'f4fdbb4c-e4b7-47a0-b83b-d91bbfcfa387',
  'justin bieber': 'e0140a67-e4d1-4f13-8a01-364355f921a4',
  'post malone': 'b1e26560-60e5-4236-bbdb-9aa5a8d5ee19',
  'bad bunny': 'b4dab03b-ed1f-4b95-9eec-c12af0a6c5b7',
  'billie eilish': 'f4abc0b5-3f7a-4eff-8f78-ac078dbce533',
  'dua lipa': '6f1a58bf-9b1b-49cf-a44a-6cefad7ae04f',
  'harry styles': 'a0f7d704-c875-4b2b-a7e8-bc15a7f8da40',
  'bruno mars': 'afb680f2-b6eb-4cd7-a70b-a63b25c763d5',
  'j cole': '358ff05b-f538-4d70-85f4-b0a655ee9830',
  'kanye west': '164f0d73-1234-4e2c-8743-d77bf2191051',
  'eminem': 'b95ce3ff-3d05-4e87-9e01-c97b66af13d4',
  'lil wayne': '5bc1871e-ff2f-410e-9f0f-e69a8b2cc846',
  'nicki minaj': '2a1afe9f-5be1-41ed-a6ba-ba40e64d4a48',
  'cardi b': '42c1c4f4-a5a4-4fe0-ba06-b2d4a6c8b9f0',
  'megan thee stallion': 'ee538f36-7be8-4f38-8bc0-51d1a8deb25e',
};

// Cache for fetched artist images
const imageCache: Map<string, string | null> = new Map();

/**
 * Search for artist and get their image from a popular release
 */
export async function getArtistImage(artistName: string): Promise<string | null> {
  const normalizedName = artistName.toLowerCase().trim();
  
  // Check cache first
  if (imageCache.has(normalizedName)) {
    return imageCache.get(normalizedName) || null;
  }

  try {
    // Get MBID from cache or search
    let artistMbid = ARTIST_MBID_CACHE[normalizedName];
    
    if (!artistMbid) {
      // Search for artist
      const searchUrl = `${MB_BASE}/artist/?query=artist:"${encodeURIComponent(artistName)}"&fmt=json&limit=1`;
      const searchResponse = await fetch(searchUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });
      
      if (!searchResponse.ok) {
        console.log(`MusicBrainz search failed: ${searchResponse.status}`);
        return null;
      }
      
      const searchData = await searchResponse.json();
      if (!searchData.artists || searchData.artists.length === 0) {
        imageCache.set(normalizedName, null);
        return null;
      }
      
      artistMbid = searchData.artists[0].id;
    }

    // Get artist's release groups (albums)
    const releaseUrl = `${MB_BASE}/release-group?artist=${artistMbid}&type=album&limit=5&fmt=json`;
    const releaseResponse = await fetch(releaseUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });
    
    if (!releaseResponse.ok) {
      imageCache.set(normalizedName, null);
      return null;
    }
    
    const releaseData = await releaseResponse.json();
    const releaseGroups = releaseData['release-groups'] || [];
    
    // Try to get cover art from each release
    for (const rg of releaseGroups) {
      try {
        const coverUrl = `${CAA_BASE}/release-group/${rg.id}/front-250`;
        const coverResponse = await fetch(coverUrl, { method: 'HEAD' });
        
        if (coverResponse.ok || coverResponse.status === 307) {
          const imageUrl = coverUrl;
          imageCache.set(normalizedName, imageUrl);
          return imageUrl;
        }
      } catch {
        continue;
      }
    }
    
    imageCache.set(normalizedName, null);
    return null;
  } catch (error) {
    console.error('MusicBrainz error:', error);
    imageCache.set(normalizedName, null);
    return null;
  }
}

/**
 * Get album artwork from Cover Art Archive
 */
export async function getAlbumArt(albumName: string, artistName: string): Promise<string | null> {
  const cacheKey = `${artistName.toLowerCase()}-${albumName.toLowerCase()}`;
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey) || null;
  }

  try {
    // Search for release
    const query = `release:"${albumName}" AND artist:"${artistName}"`;
    const searchUrl = `${MB_BASE}/release/?query=${encodeURIComponent(query)}&fmt=json&limit=1`;
    
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.releases || data.releases.length === 0) return null;
    
    const releaseId = data.releases[0].id;
    const coverUrl = `${CAA_BASE}/release/${releaseId}/front-250`;
    
    // Check if image exists
    const coverResponse = await fetch(coverUrl, { method: 'HEAD' });
    if (coverResponse.ok || coverResponse.status === 307) {
      imageCache.set(cacheKey, coverUrl);
      return coverUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Album art error:', error);
    return null;
  }
}

/**
 * Batch fetch artist images with rate limiting
 */
export async function batchGetArtistImages(artistNames: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  
  // Process with 500ms delay between requests to respect rate limits
  for (const name of artistNames) {
    const image = await getArtistImage(name);
    results.set(name.toLowerCase(), image);
    
    // Rate limit: 1 request per second to MusicBrainz
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}
