import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeTitle } from "./game.server";

const MOVIE_TARGET = 500;
const TV_TARGET = 500;
const FEEDS_PER_FILL = 4;
const LOOKUP_CHUNK = 25;

type MediaType = "movie" | "tv";

// Apple's Store RSS charts (the /search endpoint no longer returns video results).
const MOVIE_FEEDS = [
  "https://itunes.apple.com/tr/rss/topmovies/limit=100/json",
  "https://itunes.apple.com/tr/rss/topmovies/limit=100/genre=4401/json",
  "https://itunes.apple.com/tr/rss/topmovies/limit=100/genre=4404/json",
  "https://itunes.apple.com/tr/rss/topmovies/limit=100/genre=4405/json",
  "https://itunes.apple.com/tr/rss/topmovies/limit=100/genre=4406/json",
  "https://itunes.apple.com/tr/rss/topmovies/limit=100/genre=4408/json",
  "https://itunes.apple.com/tr/rss/topmovies/limit=100/genre=4409/json",
  "https://itunes.apple.com/tr/rss/topmovies/limit=100/genre=4410/json",
  "https://itunes.apple.com/us/rss/topmovies/limit=100/json",
  "https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4404/json",
  "https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4405/json",
  "https://itunes.apple.com/us/rss/topmovies/limit=100/genre=4408/json",
] as const;

const TV_FEEDS = [
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4301/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4302/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4303/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4304/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4305/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4306/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4307/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4308/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4309/json",
  "https://itunes.apple.com/us/rss/toptvepisodes/limit=100/genre=4310/json",
  "https://itunes.apple.com/tr/rss/toptvepisodes/limit=100/json",
] as const;

type Row = {
  itunes_id: string;
  media_type: MediaType;
  title: string;
  subtitle: string;
  preview_url: string;
  artwork_url: string | null;
};

type LookupResult = {
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
    .replace(/,\s*(?:Season|Series|Sezon)\s+\d+.*$/i, "")
    .replace(/\s*\((?:Turkish|Türkçe|Dubbed|Altyazılı)[^)]*\)\s*$/i, "")
    .trim();
}

function bigArt(url?: string): string | null {
  return url ? url.replace("100x100", "600x600") : null;
}

function databaseError(message: string, detail?: string): Error {
  return new Error(detail ? `${message}: ${detail}` : message);
}

async function existingRows(mediaType: MediaType) {
  const { data, error } = await supabaseAdmin
    .from("titles")
    .select("itunes_id, title")
    .eq("media_type", mediaType);
  if (error) throw databaseError("Film-dizi tablosuna ulaşılamadı", error.message);
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
  if (error) throw databaseError("Film-dizi tablosuna ulaşılamadı", error.message);
  return count ?? 0;
}

async function feedIds(url: string): Promise<string[]> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const payload = (await res.json()) as {
    feed?: { entry?: { id?: { attributes?: { "im:id"?: string } } }[] };
  };
  const entries = payload.feed?.entry ?? [];
  return entries.map((e) => e.id?.attributes?.["im:id"]).filter((v): v is string => !!v);
}

async function lookup(ids: string[], country: string): Promise<LookupResult[]> {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${ids.join(",")}&country=${country}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return [];
  const payload = (await res.json()) as { results?: LookupResult[] };
  return payload.results ?? [];
}

function toRow(result: LookupResult, mediaType: MediaType): Row | null {
  if (!result.previewUrl || !result.trackId) return null;
  const year = result.releaseDate ? new Date(result.releaseDate).getFullYear() : null;
  const yearLabel = year && Number.isFinite(year) ? String(year) : null;

  if (mediaType === "movie") {
    if (result.kind !== "feature-movie" || !result.trackName) return null;
    return {
      itunes_id: String(result.trackId),
      media_type: "movie",
      title: cleanTitle(result.trackName),
      subtitle: ["Film", yearLabel].filter(Boolean).join(" · "),
      preview_url: result.previewUrl,
      artwork_url: bigArt(result.artworkUrl100),
    };
  }

  if (result.kind !== "tv-episode") return null;
  // artistName is the series name; collectionName includes the season.
  const title = cleanTitle(result.artistName ?? result.collectionName ?? "");
  if (!title) return null;
  return {
    itunes_id: String(result.trackId),
    media_type: "tv",
    title,
    subtitle: ["Dizi", yearLabel].filter(Boolean).join(" · "),
    preview_url: result.previewUrl,
    artwork_url: bigArt(result.artworkUrl100),
  };
}

async function fillMediaType(mediaType: MediaType, currentCount: number): Promise<number> {
  const target = mediaType === "movie" ? MOVIE_TARGET : TV_TARGET;
  if (currentCount >= target) return 0;

  const feeds = mediaType === "movie" ? MOVIE_FEEDS : TV_FEEDS;
  const existing = await existingRows(mediaType);
  const rows: Row[] = [];
  const startAt = Math.floor(currentCount / 60) % feeds.length;

  for (let offset = 0; offset < Math.min(FEEDS_PER_FILL, feeds.length); offset++) {
    const url = feeds[(startAt + offset) % feeds.length]!;
    const country = url.includes("/tr/rss/") ? "tr" : "us";
    let ids: string[];
    try {
      ids = await feedIds(url);
    } catch {
      continue;
    }
    const fresh = ids.filter((id) => !existing.ids.has(id));

    for (let i = 0; i < fresh.length; i += LOOKUP_CHUNK) {
      let results: LookupResult[];
      try {
        results = await lookup(fresh.slice(i, i + LOOKUP_CHUNK), country);
      } catch {
        continue;
      }
      for (const result of results) {
        const row = toRow(result, mediaType);
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
  if (movies + tv >= 40) {
    // Pool is usable; top it up in the background without blocking the round.
    await Promise.allSettled([fillMediaType("movie", movies), fillMediaType("tv", tv)]);
    return;
  }

  const results = await Promise.allSettled([
    fillMediaType("movie", movies),
    fillMediaType("tv", tv),
  ]);
  const total = (await countOf("movie")) + (await countOf("tv"));
  if (total === 0) {
    const reason = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw new Error(
      reason?.reason instanceof Error
        ? `Film-dizi havuzu alınamadı: ${reason.reason.message}`
        : "Film-dizi havuzu alınamadı. Birkaç saniye sonra tekrar dene",
    );
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
