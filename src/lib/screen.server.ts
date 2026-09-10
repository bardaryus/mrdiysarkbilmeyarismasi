import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeTitle } from "./game.server";

const MOVIE_TARGET = 500;
const TV_TARGET = 120;

const MOVIE_GENRES = [
  "",
  "/genre=4401",
  "/genre=4404",
  "/genre=4406",
  "/genre=4408",
  "/genre=4413",
  "/genre=4416",
  "/genre=4412",
  "/genre=4402",
  "/genre=4405",
  "/genre=4403",
  "/genre=4410",
];

/** Popular series people actually know — used to fetch official 30s clips. */
const SHOWS = [
  "Breaking Bad",
  "Better Call Saul",
  "The Office",
  "Friends",
  "The Sopranos",
  "The Wire",
  "Chernobyl",
  "Band of Brothers",
  "The Last of Us",
  "House of the Dragon",
  "Succession",
  "Ted Lasso",
  "Severance",
  "The Bear",
  "Fargo",
  "True Detective",
  "Westworld",
  "Silicon Valley",
  "Curb Your Enthusiasm",
  "Boardwalk Empire",
  "Euphoria",
  "Barry",
  "Watchmen",
  "The Newsroom",
  "Big Little Lies",
  "The Leftovers",
  "Mare of Easttown",
  "The White Lotus",
  "Mr. Robot",
  "Suits",
  "House",
  "Lost",
  "Prison Break",
  "24",
  "Homeland",
  "Dexter",
  "The Walking Dead",
  "Sons of Anarchy",
  "Vikings",
  "Black Sails",
  "Spartacus",
  "Rome",
  "The Americans",
  "Justified",
  "Yellowstone",
  "Billions",
  "Ray Donovan",
  "Shameless",
  "It's Always Sunny in Philadelphia",
  "Modern Family",
  "How I Met Your Mother",
  "The Big Bang Theory",
  "Brooklyn Nine-Nine",
  "Parks and Recreation",
  "Community",
  "Arrested Development",
  "Seinfeld",
  "Frasier",
  "Cheers",
  "Scrubs",
  "Grey's Anatomy",
  "The Good Doctor",
  "Chicago Fire",
  "Chicago Med",
  "Law & Order",
  "The Blacklist",
  "Person of Interest",
  "White Collar",
  "Burn Notice",
  "Psych",
  "Monk",
  "Castle",
  "Bones",
  "NCIS",
  "Criminal Minds",
  "CSI: Crime Scene Investigation",
  "Mindhunter",
  "Narcos",
  "Ozark",
  "The Crown",
  "Downton Abbey",
  "Peaky Blinders",
  "Sherlock",
  "Doctor Who",
  "Black Mirror",
  "The Handmaid's Tale",
  "Stranger Things",
  "The Umbrella Academy",
  "The Boys",
  "Invincible",
  "Daredevil",
  "Jessica Jones",
  "Loki",
  "WandaVision",
  "The Mandalorian",
  "Andor",
  "Star Trek: Discovery",
  "The Expanse",
  "Battlestar Galactica",
  "Firefly",
  "Supernatural",
  "The Vampire Diaries",
  "Teen Wolf",
  "Gossip Girl",
  "Riverdale",
  "The Flash",
  "Arrow",
  "Gotham",
  "Smallville",
  "Heroes",
  "Fringe",
  "The X-Files",
  "Twin Peaks",
  "Rick and Morty",
  "South Park",
  "Family Guy",
  "The Simpsons",
  "Futurama",
  "BoJack Horseman",
  "Archer",
  "Adventure Time",
  "Avatar: The Last Airbender",
  "Game of Thrones",
  "The Witcher",
  "Wednesday",
  "Squid Game",
  "Money Heist",
  "Dark",
  "Emily in Paris",
  "Bridgerton",
];

type Row = {
  itunes_id: string;
  media_type: "movie" | "tv";
  title: string;
  subtitle: string;
  preview_url: string;
  artwork_url: string | null;
};

type LookupResult = {
  wrapperType?: string;
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
    .replace(/\s*\((?:Turkish|Türkçe|Dubbed|Altyazılı)[^)]*\)\s*$/i, "")
    .trim();
}

function bigArt(url?: string): string | null {
  return url ? url.replace("100x100", "600x600") : null;
}

async function existingIds(mediaType: "movie" | "tv"): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("titles")
    .select("itunes_id")
    .eq("media_type", mediaType);
  return new Set((data ?? []).map((r) => r.itunes_id));
}

async function countOf(mediaType: "movie" | "tv"): Promise<number> {
  const { count } = await supabaseAdmin
    .from("titles")
    .select("id", { count: "exact", head: true })
    .eq("media_type", mediaType);
  return count ?? 0;
}

async function fetchMovieBatch(): Promise<void> {
  const have = await existingIds("movie");
  const ids: string[] = [];

  for (const genre of MOVIE_GENRES) {
    if (ids.length >= 120) break;
    try {
      const res = await fetch(`https://itunes.apple.com/tr/rss/topmovies/limit=100${genre}/json`);
      if (!res.ok) continue;
      const feed = (await res.json()) as {
        feed?: { entry?: { id?: { attributes?: { "im:id"?: string } } }[] };
      };
      for (const entry of feed.feed?.entry ?? []) {
        const id = entry.id?.attributes?.["im:id"];
        if (id && !have.has(id) && !ids.includes(id)) ids.push(id);
      }
    } catch {
      continue;
    }
  }

  const rows: Row[] = [];
  for (let i = 0; i < ids.length && i < 120; i += 25) {
    const chunk = ids.slice(i, i + 25);
    try {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${chunk.join(",")}&country=tr`);
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: LookupResult[] };
      for (const r of data.results ?? []) {
        if (!r.previewUrl || !r.trackName || !r.trackId) continue;
        const year = r.releaseDate ? new Date(r.releaseDate).getFullYear() : null;
        rows.push({
          itunes_id: String(r.trackId),
          media_type: "movie",
          title: cleanTitle(r.trackName),
          subtitle: [year ? String(year) : null, r.artistName].filter(Boolean).join(" · "),
          preview_url: r.previewUrl,
          artwork_url: bigArt(r.artworkUrl100),
        });
      }
    } catch {
      continue;
    }
  }

  if (rows.length > 0) {
    await supabaseAdmin.from("titles").upsert(rows, { onConflict: "itunes_id" });
  }
}

async function fetchTvBatch(): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("titles")
    .select("title")
    .eq("media_type", "tv");
  const have = new Set((existing ?? []).map((r) => normalizeTitle(r.title)));
  const todo = SHOWS.filter((s) => !have.has(normalizeTitle(s))).slice(0, 12);

  const rows: Row[] = [];
  for (const show of todo) {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(show)}&entity=tvEpisode&limit=12&country=us`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: LookupResult[] };
      const wanted = normalizeTitle(show);
      const match = (data.results ?? []).find(
        (r) => r.previewUrl && r.artistName && normalizeTitle(r.artistName) === wanted,
      );
      if (!match) continue;
      rows.push({
        itunes_id: String(match.trackId),
        media_type: "tv",
        title: show,
        subtitle: "Dizi",
        preview_url: match.previewUrl!,
        artwork_url: bigArt(match.artworkUrl100),
      });
    } catch {
      continue;
    }
  }

  if (rows.length > 0) {
    await supabaseAdmin.from("titles").upsert(rows, { onConflict: "itunes_id" });
  }
}

/** Tops the film/series pool up a little on each call, without long requests. */
export async function ensureTitlePool(): Promise<void> {
  const [movies, tv] = await Promise.all([countOf("movie"), countOf("tv")]);
  if (movies < MOVIE_TARGET) await fetchMovieBatch();
  if (tv < TV_TARGET) await fetchTvBatch();

  const total = (await countOf("movie")) + (await countOf("tv"));
  if (total === 0) throw new Error("Film-dizi havuzu doldurulamadı, tekrar dene");
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
  const used = new Set((recent ?? []).map((r) => r.track_name));

  const { data: rows } = await supabaseAdmin
    .from("titles")
    .select("title, subtitle, preview_url, artwork_url");
  const all = rows ?? [];
  const pool = all.filter((t) => !used.has(t.title));
  const usable = pool.length > 0 ? pool : all;
  if (usable.length === 0) throw new Error("Film-dizi havuzu boş");
  return usable[Math.floor(Math.random() * usable.length)]!;
}
