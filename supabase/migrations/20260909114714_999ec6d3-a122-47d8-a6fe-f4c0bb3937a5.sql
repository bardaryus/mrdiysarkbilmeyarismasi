DROP POLICY "rounds are publicly viewable" ON public.rounds;
REVOKE SELECT ON public.rounds FROM anon, authenticated;
DROP POLICY "tracks are publicly viewable" ON public.tracks;
REVOKE SELECT ON public.tracks FROM anon, authenticated;