import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeTitle } from "./game.server";

const MOVIE_TARGET = 500;
const TV_TARGET = 500;
const SEARCH_LIMIT = 200;
const MAX_SEARCHES_PER_FILL = 4;

// Several broad searches are merged, de-duplicated and cached in Supabase.
const MOVIE_SEARCHES = [
  "popular movie",
  "action movie",
  "comedy movie",
  "drama movie",
  "thriller movie",
  "animation movie",
  "science fiction movie",
  "adventure movie",
  "family movie",
  "fantasy movie",
  "crime movie",
  "romance movie",
] as const;

const TV_SEARCHES = [
  "popular tv series",
  "drama series",
  "comedy series",
  "crime series",
  "thriller series",
  "science fiction series",
  "action series",
  "family series",
  "animation series",
  "fantasy series",
  "mystery series",
  "documentary series",
] as const;

type MediaType = "movie" | "tv";

type Row = {
  itunes_id: string;
  media_type: MediaType;
  title: string;
  subtitle: string;
  preview_url: string;
  artwork_url: string | null;
};

type SearchResult = {
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  releaseDate?: string;
};

function cleanTitle(raw: string): string {
  return raw
    .replace(/^"(.*)"$/, "$1")
    .replace(/,\s*(?:Season|Series)\s+\d+.*$/i, "")
    .replace(/\s*\((?:Turkish|Türkçe|Dubbed|Altyazılı)[^)]*\)\s*$/i, "")
    .trim();
}

function bigArt(url?: string): string | null {
  return url ? url.replace("100x100", "600x600") : null;
}

function databaseError(message: string, detail?: string): Error {
  return new Error(detail ? `${message}: ${detail}` : message);
}

async function existingRows(mediaType: MediaType): Promise<{
  ids: Set<string>;
  titles: Set<string>;
}> {
  const { data, error } = await supabaseAdmin
    .from("titles")
    .select("itunes_id, title")
    .eq("media_type", mediaType);
  if (error) {
    throw databaseError(
      "Film-dizi tablosuna ulaşılamadı. Supabase migration dosyalarını çalıştır",
      error.message,
    );
  }
  return {
    ids: new Set((data ?? []).map((row) => row.itunes_id)),
    titles: new Set((data ?? []).map((row) => normalizeTitle(row.title))),
  };
}

async function countOf(mediaType: MediaType): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("titles")
    .select("id", { count: "exact", head: true })
    .eq("media_type", mediaType);
  if (error) {
    throw databaseError(
      "Film-dizi tablosuna ulaşılamadı. Supabase migration dosyalarını çalıştır",
      error.message,
    );
  }
  return count ?? 0;
}

function toMovieRow(result: SearchResult): Row | null {
  if (result.kind !== "feature-movie" || !result.previewUrl || !result.trackName || !result.trackId) {
    return null;
  }
  const year = result.releaseDate ? new Date(result.releaseDate).getFullYear() : null;
  return {
    itunes_id: String(result.trackId),
    media_type: "movie",
    title: cleanTitle(result.trackName),
    subtitle: [Number.isFinite(year) ? String(year) : null, result.artistName]
      .filter(Boolean)
      .join(" · "),
    preview_url: result.previewUrl,
    artwork_url: bigArt(result.artworkUrl100),
  };
}

function toTvRow(result: SearchResult): Row | null {
  if (result.kind !== "tv-episode" || !result.previewUrl || !result.trackId) return null;

  // trackName is the episode name; collectionName is the series/season name.
  const title = cleanTitle(result.collectionName ?? result.artistName ?? "");
  if (!title) return null;
  const year = result.releaseDate ? new Date(result.releaseDate).getFullYear() : null;
  return {
    itunes_id: String(result.trackId),
    media_type: "tv",
    title,
    subtitle: ["Dizi", Number.isFinite(year) ? String(year) : null].filter(Boolean).join(" · "),
    preview_url: result.previewUrl,
    artwork_url: bigArt(result.artworkUrl100),
  };
}

async function searchStore(mediaType: MediaType, term: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    term,
    country: mediaType === "movie" ? "tr" : "us",
    media: mediaType === "movie" ? "movie" : "tvShow",
    entity: mediaType === "movie" ? "movie" : "tvEpisode",
    limit: String(SEARCH_LIMIT),
    explicit: "No",
  });
  const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Apple Search API ${response.status}`);
  const payload = (await response.json()) as { results?: SearchResult[] };
  return payload.results ?? [];
}

async function fillMediaType(mediaType: MediaType, currentCount: number): Promise<number> {
  const target = mediaType === "movie" ? MOVIE_TARGET : TV_TARGET;
  if (currentCount >= target) return 0;

  const searches = mediaType === "movie" ? MOVIE_SEARCHES : TV_SEARCHES;
  const existing = await existingRows(mediaType);
  const rows: Row[] = [];
  const startAt = Math.floor(currentCount / 75) % searches.length;

  for (let offset = 0; offset < Math.min(MAX_SEARCHES_PER_FILL, searches.length); offset++) {
    const term = searches[(startAt + offset) % searches.length]!;
    let results: SearchResult[];
    try {
      results = await searchStore(mediaType, term);
    } catch {
      continue;
    }

    for (const result of results) {
      const row = mediaType === "movie" ? toMovieRow(result) : toTvRow(result);
      if (!row || existing.ids.has(row.itunes_id)) continue;
      const normalized = normalizeTitle(row.title);
      if (!normalized || existing.titles.has(normalized)) continue;

      existing.ids.add(row.itunes_id);
      existing.titles.add(normalized);
      rows.push(row);
      if (currentCount + rows.length >= target) break;
    }
    if (currentCount + rows.length >= target) break;
  }

  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from("titles").upsert(rows, { onConflict: "itunes_id" });
  if (error) throw databaseError("Film-dizi havuzu kaydedilemedi", error.message);
  return rows.length;
}

/** Keeps a cached pool of up to 500 films and 500 series. */
export async function ensureTitlePool(): Promise<void> {
  const [movies, tv] = await Promise.all([countOf("movie"), countOf("tv")]);

  if (movies + tv === 0) {
    // First use: try both catalogues so the first screen round can start.
    await Promise.all([fillMediaType("movie", movies), fillMediaType("tv", tv)]);
  } else {
    // Later rounds progressively fill the catalogue without a long request.
    await Promise.allSettled([fillMediaType("movie", movies), fillMediaType("tv", tv)]);
  }

  const total = (await countOf("movie")) + (await countOf("tv"));
  if (total === 0) {
    throw new Error("Film-dizi havuzu alınamadı. Birkaç saniye sonra tekrar dene");
  }
}

export async function pickRandomTitle(roomId: string) {
  await ensureTitlePool();

  const { data: recent } = await supabaseAdmin
    .from("rounds")
    .select("track_name")
    .eq("room_id", roomId)
    .eq("kind", "screen")
    .order("round_no", { ascending: false })
    .limit(40);
  const used = new Set((recent ?? []).map((row) => row.track_name));

  const { data: rows, error } = await supabaseAdmin
    .from("titles")
    .select("title, subtitle, preview_url, artwork_url");
  if (error) throw databaseError("Film-dizi havuzu okunamadı", error.message);

  const all = rows ?? [];
  const pool = all.filter((title) => !used.has(title.title));
  const usable = pool.length > 0 ? pool : all;
  if (usable.length === 0) throw new Error("Film-dizi havuzu boş");
  return usable[Math.floor(Math.random() * usable.length)]!;
}
