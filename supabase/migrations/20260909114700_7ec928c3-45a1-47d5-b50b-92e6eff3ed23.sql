CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  target_score int NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'lobby',
  winner_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  score int NOT NULL DEFAULT 0,
  is_host boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, name)
);

CREATE TABLE public.rounds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round_no int NOT NULL DEFAULT 1,
  track_name text NOT NULL,
  artist_name text NOT NULL,
  preview_url text NOT NULL,
  artwork_url text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  winner_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  ended boolean NOT NULL DEFAULT false
);

CREATE INDEX rounds_room_idx ON public.rounds (room_id, round_no DESC);

CREATE TABLE public.guesses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  text text NOT NULL,
  correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guesses_round_idx ON public.guesses (round_id, created_at DESC);

CREATE TABLE public.tracks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itunes_id text NOT NULL UNIQUE,
  track_name text NOT NULL,
  artist_name text NOT NULL,
  preview_url text NOT NULL,
  artwork_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT SELECT ON public.players TO anon, authenticated;
GRANT SELECT ON public.rounds TO anon, authenticated;
GRANT SELECT ON public.guesses TO anon, authenticated;
GRANT SELECT ON public.tracks TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.players TO service_role;
GRANT ALL ON public.rounds TO service_role;
GRANT ALL ON public.guesses TO service_role;
GRANT ALL ON public.tracks TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms are publicly viewable" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "players are publicly viewable" ON public.players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rounds are publicly viewable" ON public.rounds FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "guesses are publicly viewable" ON public.guesses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tracks are publicly viewable" ON public.tracks FOR SELECT TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guesses;