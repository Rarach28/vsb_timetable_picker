const roomIdCache = new Map();

const isDev = import.meta.env.DEV;

function getApiUrl(roomCode) {
  const query = encodeURIComponent(roomCode);
  const apiUrl = `https://mapy.vsb.cz/maps/api/v0/rooms/autocomplete?query=${query}&language=cs`;

  if (isDev) {
    return `/mapy-api/v0/rooms/autocomplete?query=${query}&language=cs`;
  }
  return `https://corsproxy.io/?url=${encodeURIComponent(apiUrl)}`;
}

function openMapWithId(id) {
  window.open(`https://mapy.vsb.cz/maps/?id=${id}&type=rooms&lang=cs`, "_blank");
}

export async function openRoomMap(roomCode) {
  if (!roomCode) return;

  // Check cache first
  if (roomIdCache.has(roomCode)) {
    const id = roomIdCache.get(roomCode);
    if (id) {
      openMapWithId(id);
      return;
    }
    // cached null = previous fetch failed, try again
  }

  try {
    const res = await fetch(getApiUrl(roomCode));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0 && data[0].id) {
      const id = data[0].id;
      roomIdCache.set(roomCode, id);
      openMapWithId(id);
      return;
    }
  } catch {
    // CORS or network error — don't cache, allow retry
  }

  // Fallback: open map homepage (no reliable search-by-code URL exists)
  window.open("https://mapy.vsb.cz/maps/", "_blank");
}
