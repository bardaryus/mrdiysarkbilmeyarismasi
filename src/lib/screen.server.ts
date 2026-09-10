import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeTitle } from "./game.server";

const MOVIE_TARGET = 230;
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

/** Popular movies people actually know — used to fetch official 30s preview clips via Search API. */
const MOVIES = [
  "The Shawshank Redemption",
  "The Godfather",
  "The Dark Knight",
  "Pulp Fiction",
  "Forrest Gump",
  "Inception",
  "Fight Club",
  "The Matrix",
  "Goodfellas",
  "The Lord of the Rings: The Fellowship of the Ring",
  "The Lord of the Rings: The Two Towers",
  "The Lord of the Rings: The Return of the King",
  "Star Wars",
  "The Empire Strikes Back",
  "Titanic",
  "Jurassic Park",
  "The Avengers",
  "Avengers: Endgame",
  "Avengers: Infinity War",
  "Iron Man",
  "Spider-Man",
  "Spider-Man: No Way Home",
  "Black Panther",
  "The Lion King",
  "Toy Story",
  "Finding Nemo",
  "Shrek",
  "Up",
  "Coco",
  "Inside Out",
  "The Incredibles",
  "WALL-E",
  "Frozen",
  "Gladiator",
  "Braveheart",
  "Saving Private Ryan",
  "Schindler's List",
  "The Silence of the Lambs",
  "Se7en",
  "The Departed",
  "No Country for Old Men",
  "There Will Be Blood",
  "The Prestige",
  "Interstellar",
  "Dunkirk",
  "Oppenheimer",
  "Whiplash",
  "La La Land",
  "Parasite",
  "Joker",
  "Django Unchained",
  "Inglourious Basterds",
  "Kill Bill",
  "Reservoir Dogs",
  "The Wolf of Wall Street",
  "Catch Me If You Can",
  "Gone Girl",
  "Shutter Island",
  "American Beauty",
  "The Green Mile",
  "A Beautiful Mind",
  "Good Will Hunting",
  "The Truman Show",
  "Eternal Sunshine of the Spotless Mind",
  "Memento",
  "The Sixth Sense",
  "Signs",
  "Split",
  "Get Out",
  "Us",
  "A Quiet Place",
  "Hereditary",
  "The Conjuring",
  "It",
  "The Exorcist",
  "Psycho",
  "Jaws",
  "Alien",
  "Aliens",
  "Predator",
  "Terminator 2: Judgment Day",
  "The Terminator",
  "RoboCop",
  "Blade Runner",
  "Blade Runner 2049",
  "Mad Max: Fury Road",
  "John Wick",
  "Die Hard",
  "Speed",
  "Mission: Impossible",
  "Mission: Impossible - Fallout",
  "The Bourne Identity",
  "Casino Royale",
  "Skyfall",
  "No Time to Die",
  "Top Gun",
  "Top Gun: Maverick",
  "Gladiator II",
  "300",
  "Troy",
  "Kingdom of Heaven",
  "Rocky",
  "Creed",
  "The Karate Kid",
  "Rush",
  "Ford v Ferrari",
  "Moneyball",
  "The Social Network",
  "Steve Jobs",
  "The Imitation Game",
  "The Theory of Everything",
  "A Star Is Born",
  "Bohemian Rhapsody",
  "Rocketman",
  "Elvis",
  "Green Book",
  "12 Years a Slave",
  "Moonlight",
  "Spotlight",
  "Birdman",
  "The Revenant",
  "The Grand Budapest Hotel",
  "Once Upon a Time in Hollywood",
  "Knives Out",
  "Glass Onion",
  "Everything Everywhere All at Once",
  "The Shape of Water",
  "Pan's Labyrinth",
  "Life of Pi",
  "Slumdog Millionaire",
  "The Curious Case of Benjamin Button",
  "Cast Away",
  "Big Fish",
  "Edward Scissorhands",
  "Sweeney Todd",
  "Charlie and the Chocolate Factory",
  "Alice in Wonderland",
  "Harry Potter and the Sorcerer's Stone",
  "Harry Potter and the Deathly Hallows: Part 2",
  "Fantastic Beasts and Where to Find Them",
  "Pirates of the Caribbean: The Curse of the Black Pearl",
  "The Chronicles of Narnia: The Lion, the Witch and the Wardrobe",
  "Percy Jackson & the Olympians: The Lightning Thief",
  "The Hunger Games",
  "Divergent",
  "Twilight",
  "Fifty Shades of Grey",
  "The Notebook",
  "La Vie en Rose",
  "Pride and Prejudice",
  "Little Women",
  "Anna Karenina",
  "Atonement",
  "Brokeback Mountain",
  "Call Me by Your Name",
  "Moulin Rouge!",
  "Chicago",
  "Les Misérables",
  "The Greatest Showman",
  "Mamma Mia!",
  "Grease",
  "Dirty Dancing",
  "Ghost",
  "Pretty Woman",
  "When Harry Met Sally",
  "Notting Hill",
  "Love Actually",
  "The Devil Wears Prada",
  "Legally Blonde",
  "Mean Girls",
  "Clueless",
  "Bridesmaids",
  "Superbad",
  "The Hangover",
  "Anchorman: The Legend of Ron Burgundy",
  "Zoolander",
  "Dumb and Dumber",
  "Ace Ventura: Pet Detective",
  "The Mask",
  "Men in Black",
  "Ghostbusters",
  "Back to the Future",
  "E.T. the Extra-Terrestrial",
  "Indiana Jones and the Raiders of the Lost Ark",
  "Jumanji",
  "Night at the Museum",
  "The Princess Bride",
  "Willy Wonka & the Chocolate Factory",
  "Home Alone",
  "The Sandlot",
  "Stand by Me",
  "Dead Poets Society",
  "Good Morning, Vietnam",
  "Rain Man",
  "Big",
  "Groundhog Day",
  "The Truman Show",
  "Donnie Darko",
  "Fight Club",
  "American History X",
  "Requiem for a Dream",
  "Trainspotting",
  "Full Metal Jacket",
  "Apocalypse Now",
  "Platoon",
  "Black Hawk Down",
  "American Sniper",
  "Zero Dark Thirty",
  "Argo",
  "The Hurt Locker",
  "Captain Phillips",
  "Sully",
  "Deepwater Horizon",
  "World War Z",
  "I Am Legend",
  "Children of Men",
  "Gravity",
  "The Martian",
  "Arrival",
  "Dune",
  "Dune: Part Two",
  "Star Trek",
  "Guardians of the Galaxy",
  "Doctor Strange",
  "Thor: Ragnarok",
  "Captain America: The Winter Soldier",
  "Deadpool",
  "Logan",
  "X-Men: Days of Future Past",
  "Watchmen",
  "V for Vendetta",
  "Sin City",
  "300",
  "Wonder Woman",
  "Man of Steel",
  "Batman Begins",
  "The Dark Knight Rises",
  "Joker: Folie à Deux",
  "Aquaman",
  "Shazam!",
  "The Suicide Squad",
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

/** Path A: Apple's top-movies chart. Best-effort — this feed category is known to be
 * flaky/unpopulated for many storefronts, so failures here are silently tolerated
 * and Path B (below) is what actually guarantees the pool fills. Uses the US store,
 * since the Turkish iTunes storefront has almost no movie catalog / chart data. */
async function fetchMovieChartBatch(have: Set<string>): Promise<Row[]> {
  const ids: string[] = [];
  for (const genre of MOVIE_GENRES) {
    if (ids.length >= 100) break;
    try {
      const res = await fetch(`https://itunes.apple.com/us/rss/topmovies/limit=100${genre}/json`);
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
  for (let i = 0; i < ids.length; i += 25) {
    const chunk = ids.slice(i, i + 25);
    try {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${chunk.join(",")}&country=us`);
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
  return rows;
}

/** Path B: look up well-known movies by name via the Search API (same mechanism the
 * working song pool uses). This is the reliable path — it doesn't depend on Apple's
 * top-charts feed being populated for a given storefront. */
async function fetchMovieSearchBatch(haveTitles: Set<string>): Promise<Row[]> {
  const todo = MOVIES.filter((m) => !haveTitles.has(normalizeTitle(m))).slice(0, 25);
  const rows: Row[] = [];

  for (const title of todo) {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=movie&country=us&limit=5`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: LookupResult[] };
      const wanted = normalizeTitle(title);
      const results = data.results ?? [];
      // Prefer a close title match; fall back to the top-ranked result with a preview.
      const match =
        results.find((r) => r.previewUrl && r.trackName && normalizeTitle(r.trackName) === wanted) ??
        results.find((r) => r.previewUrl && r.trackName);
      if (!match || !match.trackId || !match.trackName) continue;
      const year = match.releaseDate ? new Date(match.releaseDate).getFullYear() : null;
      rows.push({
        itunes_id: String(match.trackId),
        media_type: "movie",
        title: cleanTitle(match.trackName),
        subtitle: [year ? String(year) : null, match.artistName].filter(Boolean).join(" · "),
        preview_url: match.previewUrl!,
        artwork_url: bigArt(match.artworkUrl100),
      });
    } catch {
      continue;
    }
  }
  return rows;
}

async function fetchMovieBatch(): Promise<void> {
  const have = await existingIds("movie");
  const { data: existing } = await supabaseAdmin
    .from("titles")
    .select("title")
    .eq("media_type", "movie");
  const haveTitles = new Set((existing ?? []).map((r) => normalizeTitle(r.title)));

  const [chartRows, searchRows] = await Promise.all([
    fetchMovieChartBatch(have),
    fetchMovieSearchBatch(haveTitles),
  ]);
  const rows = [...chartRows, ...searchRows];

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
      // For TV episodes, iTunes puts the network in artistName and "Show Name, Season N"
      // in collectionName — match against both since either can hold the show title.
      const match = (data.results ?? []).find((r) => {
        if (!r.previewUrl) return false;
        const artist = r.artistName ? normalizeTitle(r.artistName) : "";
        const collection = r.collectionName ? normalizeTitle(r.collectionName) : "";
        return artist === wanted || collection.startsWith(wanted) || artist.startsWith(wanted);
      });
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
