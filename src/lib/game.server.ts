import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TR_MAP: Record<string, string> = {
  ı: "i",
  ş: "s",
  ğ: "g",
  ü: "u",
  ö: "o",
  ç: "c",
  æ: "ae",
  ø: "o",
  ß: "ss",
  "&": " ve ",
};

export function normalizeTitle(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split("")
    .map((c) => TR_MAP[c] ?? c)
    .join("")
    .replace(/\(.*?\)/g, " ")
    .replace(/\[.*?\]/g, " ")
    .replace(/\b(feat|ft|featuring|with|prod|remix|remastered|remaster|version|radio edit|single|deluxe)\b.*$/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[n]!;
}

/** Fuzzy title match that tolerates small typos. */
export function isCorrectGuess(guess: string, trackName: string): boolean {
  const g = normalizeTitle(guess);
  if (g.length < 2) return false;
  const target = normalizeTitle(trackName);
  if (!target) return false;
  const candidates = new Set<string>([target]);
  // also accept the part before a dash, e.g. "sebebi yar - remix"
  const dash = target.split(/ - | \/ /)[0]!.trim();
  if (dash) candidates.add(dash);

  for (const cand of candidates) {
    if (g === cand) return true;
    const tolerance = cand.length >= 14 ? 3 : cand.length >= 8 ? 2 : 1;
    if (levenshtein(g, cand) <= tolerance) return true;
  }
  return false;
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPRSTUVYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

type FeedSong = { id: string; name: string; artistName: string; artworkUrl100?: string };

/** Fills the track pool from Apple's Turkey top-songs chart (30s previews). */
export async function ensureTrackPool(): Promise<void> {
  const { count } = await supabaseAdmin
    .from("tracks")
    .select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 60) return;

  const feedRes = await fetch(
    "https://rss.marketingtools.apple.com/api/v2/tr/music/most-played/100/songs.json",
  );
  if (!feedRes.ok) throw new Error("Şarkı listesi alınamadı");
  const feed = (await feedRes.json()) as { feed?: { results?: FeedSong[] } };
  const songs = feed.feed?.results ?? [];
  if (songs.length === 0) throw new Error("Şarkı listesi boş geldi");

  const rows: {
    itunes_id: string;
    track_name: string;
    artist_name: string;
    preview_url: string;
    artwork_url: string | null;
  }[] = [];

  for (let i = 0; i < songs.length; i += 20) {
    const chunk = songs.slice(i, i + 20);
    const ids = chunk.map((s) => s.id).join(",");
    const res = await fetch(`https://itunes.apple.com/lookup?id=${ids}&country=tr&entity=song`);
    if (!res.ok) continue;
    const data = (await res.json()) as {
      results?: {
        wrapperType?: string;
        trackId?: number;
        trackName?: string;
        artistName?: string;
        previewUrl?: string;
        artworkUrl100?: string;
      }[];
    };
    for (const r of data.results ?? []) {
      if (r.wrapperType !== "track" || !r.previewUrl || !r.trackName || !r.trackId) continue;
      rows.push({
        itunes_id: String(r.trackId),
        track_name: r.trackName,
        artist_name: r.artistName ?? "",
        preview_url: r.previewUrl,
        artwork_url: r.artworkUrl100?.replace("100x100", "400x400") ?? null,
      });
    }
  }

  if (rows.length > 0) {
    await supabaseAdmin.from("tracks").upsert(rows, { onConflict: "itunes_id" });
  }
}

export async function pickRandomTrack(roomId: string) {
  await ensureTrackPool();
  const { data: recent } = await supabaseAdmin
    .from("rounds")
    .select("track_name")
    .eq("room_id", roomId)
    .order("round_no", { ascending: false })
    .limit(25);
  const used = new Set((recent ?? []).map((r) => r.track_name));

  const { data: tracks } = await supabaseAdmin
    .from("tracks")
    .select("track_name, artist_name, preview_url, artwork_url");
  const pool = (tracks ?? []).filter((t) => !used.has(t.track_name));
  const usable = pool.length > 0 ? pool : (tracks ?? []);
  if (usable.length === 0) throw new Error("Şarkı havuzu boş");
  return usable[Math.floor(Math.random() * usable.length)]!;
}
