import { Track, DownloadedTrack } from '@/types/music';

const DB_NAME = 'KhayaBeatsDB';
const DB_VERSION = 1;
const SONGS_STORE = 'songs';
const METADATA_STORE = 'metadata';

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for audio blobs
      if (!db.objectStoreNames.contains(SONGS_STORE)) {
        const songsStore = db.createObjectStore(SONGS_STORE, { keyPath: 'videoId' });
        songsStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }

      // Store for track metadata (lightweight)
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metaStore = db.createObjectStore(METADATA_STORE, { keyPath: 'videoId' });
        metaStore.createIndex('title', 'title', { unique: false });
        metaStore.createIndex('artist', 'artist', { unique: false });
      }
    };
  });
};

export const downloadTrack = async (
  track: Track,
  audioUrl: string,
  onProgress?: (progress: number) => void
): Promise<boolean> => {
  try {
    const db = await initDB();

    // Fetch the audio with progress tracking
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error('Failed to fetch audio');

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (total > 0 && onProgress) {
        onProgress((loaded / total) * 100);
      }
    }

    const audioBlob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });

    // Store in IndexedDB
    const downloadedTrack: DownloadedTrack = {
      ...track,
      audioBlob,
      downloadedAt: new Date(),
      isDownloaded: true,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SONGS_STORE, METADATA_STORE], 'readwrite');

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(true);

      // Store the blob
      const songsStore = transaction.objectStore(SONGS_STORE);
      songsStore.put({
        videoId: track.videoId,
        audioBlob,
        downloadedAt: new Date().toISOString(),
      });

      // Store metadata separately (for quick queries)
      const metaStore = transaction.objectStore(METADATA_STORE);
      metaStore.put({
        videoId: track.videoId,
        id: track.id,
        title: track.title,
        artist: track.artist,
        thumbnailUrl: track.thumbnailUrl,
        duration: track.duration,
        downloadedAt: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error('Download error:', error);
    return false;
  }
};

export const getDownloadedTrack = async (videoId: string): Promise<{ blob: Blob; track: Track } | null> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SONGS_STORE, METADATA_STORE], 'readonly');

      const songsStore = transaction.objectStore(SONGS_STORE);
      const metaStore = transaction.objectStore(METADATA_STORE);

      const songRequest = songsStore.get(videoId);
      const metaRequest = metaStore.get(videoId);

      let blob: Blob | null = null;
      let track: Track | null = null;

      songRequest.onsuccess = () => {
        if (songRequest.result) {
          blob = songRequest.result.audioBlob;
        }
      };

      metaRequest.onsuccess = () => {
        if (metaRequest.result) {
          track = {
            id: metaRequest.result.id,
            videoId: metaRequest.result.videoId,
            title: metaRequest.result.title,
            artist: metaRequest.result.artist,
            thumbnailUrl: metaRequest.result.thumbnailUrl,
            duration: metaRequest.result.duration,
            isDownloaded: true,
          };
        }
      };

      transaction.oncomplete = () => {
        if (blob && track) {
          resolve({ blob, track });
        } else {
          resolve(null);
        }
      };

      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Get downloaded track error:', error);
    return null;
  }
};

export const isTrackDownloaded = async (videoId: string): Promise<boolean> => {
  try {
    const db = await initDB();

    return new Promise((resolve) => {
      const transaction = db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(videoId);

      request.onsuccess = () => {
        resolve(!!request.result);
      };

      request.onerror = () => {
        resolve(false);
      };
    });
  } catch {
    return false;
  }
};

export const getAllDownloadedTracks = async (): Promise<Track[]> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const tracks: Track[] = request.result.map((item: any) => ({
          id: item.id,
          videoId: item.videoId,
          title: item.title,
          artist: item.artist,
          thumbnailUrl: item.thumbnailUrl,
          duration: item.duration,
          isDownloaded: true,
        }));
        resolve(tracks);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Get all downloads error:', error);
    return [];
  }
};

export const deleteDownloadedTrack = async (videoId: string): Promise<boolean> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SONGS_STORE, METADATA_STORE], 'readwrite');

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(true);

      const songsStore = transaction.objectStore(SONGS_STORE);
      const metaStore = transaction.objectStore(METADATA_STORE);

      songsStore.delete(videoId);
      metaStore.delete(videoId);
    });
  } catch (error) {
    console.error('Delete download error:', error);
    return false;
  }
};

export const getStorageUsage = async (): Promise<{ used: number; tracks: number }> => {
  try {
    const db = await initDB();

    return new Promise((resolve) => {
      const transaction = db.transaction([SONGS_STORE], 'readonly');
      const store = transaction.objectStore(SONGS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        let totalSize = 0;
        const tracks = request.result.length;

        request.result.forEach((item: any) => {
          if (item.audioBlob) {
            totalSize += item.audioBlob.size;
          }
        });

        resolve({ used: totalSize, tracks });
      };

      request.onerror = () => {
        resolve({ used: 0, tracks: 0 });
      };
    });
  } catch {
    return { used: 0, tracks: 0 };
  }
};

export const clearAllDownloads = async (): Promise<boolean> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([SONGS_STORE, METADATA_STORE], 'readwrite');

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(true);

      const songsStore = transaction.objectStore(SONGS_STORE);
      const metaStore = transaction.objectStore(METADATA_STORE);

      songsStore.clear();
      metaStore.clear();
    });
  } catch (error) {
    console.error('Clear all downloads error:', error);
    return false;
  }
};
