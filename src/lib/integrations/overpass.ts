/** OpenStreetMap Overpass API — free, no key, read-only. */

export type OsmPlace = {
  id: number;
  name: string;
  type: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
};

export async function searchOsmPlaces(name: string, limit = 5): Promise<OsmPlace[]> {
  const term = name.trim().slice(0, 60);
  if (!term) return [];

  const safe = term.replace(/[\\/"[\]()|.*+?^${}]/g, " ").trim();
  if (!safe) return [];

  const query = `
    [out:json][timeout:20];
    (
      node["name"~"${safe}",i];
      way["name"~"${safe}",i];
    );
    out center ${limit};
  `;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "RESOLVE/1.0" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      elements?: Array<{
        id: number;
        type: string;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    };

    return (json.elements ?? [])
      .filter((e) => e.tags?.name)
      .map((e) => ({
        id: e.id,
        name: e.tags!.name!,
        type: e.tags!.amenity ?? e.tags!.place ?? e.type,
        lat: e.lat ?? e.center?.lat,
        lon: e.lon ?? e.center?.lon,
        tags: e.tags,
      }))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function pingOverpass(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent("[out:json];node(1);out;"),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, message: `Overpass HTTP ${res.status}` };
    return { ok: true, message: "OpenStreetMap Overpass connected" };
  } catch {
    return { ok: false, message: "Overpass unreachable" };
  }
}
