import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Crown, Loader2, Music4, Play, Volume2, Trophy, Check, X } from "lucide-react";

import { getRoomState, joinRoom, startRound, submitGuess, resetGame } from "@/lib/game.functions";
import { loadPlayerId, savePlayerId } from "@/lib/player-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/oda/$code")({
  head: () => ({
    meta: [
      { title: "Oyun odası — Şarkı Bil" },
      {
        name: "description",
        content: "Şarkı çalıyor. Adını ilk doğru yazan 10 puan alır.",
      },
      { property: "og:title", content: "Oyun odası — Şarkı Bil" },
      { property: "og:description", content: "Odaya katıl, şarkıyı ilk sen bil." },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const roomCode = code.toUpperCase();
  const navigate = useNavigate();

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPlayerId(loadPlayerId(roomCode));
    setReady(true);
  }, [roomCode]);

  if (!ready) {
    return (
      <main className="stage-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!playerId) {
    return (
      <JoinCard
        roomCode={roomCode}
        onJoined={(id) => {
          savePlayerId(roomCode, id);
          setPlayerId(id);
        }}
        onBack={() => navigate({ to: "/" })}
      />
    );
  }

  return <Game roomCode={roomCode} playerId={playerId} />;
}

function JoinCard({
  roomCode,
  onJoined,
  onBack,
}: {
  roomCode: string;
  onJoined: (playerId: string) => void;
  onBack: () => void;
}) {
  const join = useServerFn(joinRoom);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setBusy(true);
    setError(null);
    try {
      const res = await join({ data: { code: roomCode, name: name.trim() } });
      onJoined(res.playerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Katılamadın");
      setBusy(false);
    }
  }

  return (
    <main className="stage-bg flex min-h-screen items-center justify-center px-5">
      <div className="panel w-full max-w-sm p-8">
        <h1 className="text-2xl font-black">
          <span className="text-primary">{roomCode}</span> odasına katıl
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bir takma ad yaz, hemen oyuna gir.
        </p>
        <div className="mt-6 space-y-2">
          <Label htmlFor="join-name">Takma adın</Label>
          <Input
            id="join-name"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && handleJoin()}
          />
        </div>
        <Button
          className="mt-5 h-11 w-full font-bold"
          disabled={busy || name.trim().length < 2}
          onClick={handleJoin}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Katıl
        </Button>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={onBack}>
          Ana sayfa
        </Button>
      </div>
    </main>
  );
}

function Game({ roomCode, playerId }: { roomCode: string; playerId: string }) {
  const fetchState = useServerFn(getRoomState);
  const start = useServerFn(startRound);
  const guessFn = useServerFn(submitGuess);
  const reset = useServerFn(resetGame);

  const [guess, setGuess] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);

  const audioRef = useRef<HTMLVideoElement | null>(null);
  const playedRoundRef = useRef<string | null>(null);

  const { data, refetch, error } = useQuery({
    queryKey: ["room", roomCode, playerId],
    queryFn: () => fetchState({ data: { code: roomCode, playerId } }),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const round = data?.round ?? null;
  const skew = data ? data.serverNow - Date.now() : 0;
  const remaining = round && !round.ended
    ? Math.max(0, Math.ceil((new Date(round.endsAt).getTime() - (now + skew)) / 1000))
    : 0;

  // play the preview when a new round starts
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !round || round.ended) return;
    if (playedRoundRef.current === round.id) return;
    playedRoundRef.current = round.id;
    audio.src = round.previewUrl;
    const elapsed = Math.max(0, (Date.now() + skew - new Date(round.startedAt).getTime()) / 1000);
    audio.currentTime = Math.min(elapsed, 25);
    audio.play().catch(() => setSoundOn(false));
    setGuess("");
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id, round?.ended]);

  // stop the music the moment the round is over
  useEffect(() => {
    if (round?.ended && audioRef.current) audioRef.current.pause();
  }, [round?.ended]);

  const me = data?.me ?? null;
  const leader = useMemo(() => data?.players?.[0] ?? null, [data?.players]);

  async function handleGuess() {
    if (!guess.trim() || sending) return;
    setSending(true);
    setActionError(null);
    try {
      const res = await guessFn({ data: { code: roomCode, playerId, guess: guess.trim() } });
      setFeedback(res.correct && !res.tooLate ? "correct" : "wrong");
      setGuess("");
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Cevap gönderilemedi");
    } finally {
      setSending(false);
    }
  }

  async function handleStart() {
    setActionError(null);
    try {
      if (audioRef.current) {
        audioRef.current.muted = false;
        setSoundOn(true);
      }
      await start({ data: { code: roomCode, playerId } });
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Tur başlatılamadı");
    }
  }

  async function handleReset() {
    setActionError(null);
    try {
      await reset({ data: { code: roomCode, playerId } });
      playedRoundRef.current = null;
      await refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Sıfırlanamadı");
    }
  }

  if (error) {
    return (
      <main className="stage-bg flex min-h-screen items-center justify-center px-5 text-center">
        <div className="panel max-w-sm p-8">
          <h1 className="text-xl font-bold">Oda bulunamadı</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kod yanlış olabilir ya da oda kapanmış.
          </p>
        </div>
      </main>
    );
  }

  const finished = data?.room.status === "finished";
  const roundActive = !!round && !round.ended;
  const isScreen = round?.kind === "screen";
  const mode = data?.room.mode ?? "music";

  return (
    <main className="stage-bg min-h-screen px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="glow-ring flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Music4 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs tracking-widest text-muted-foreground">ODA KODU</p>
              <p className="font-display text-xl font-black tracking-[0.3em]">{roomCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
            >
              <Copy className="mr-2 h-4 w-4" /> Bağlantıyı kopyala
            </Button>
            {!soundOn && (
              <Button
                size="sm"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.muted = false;
                    audioRef.current.play().catch(() => {});
                  }
                  setSoundOn(true);
                }}
              >
                <Volume2 className="mr-2 h-4 w-4" /> Sesi aç
              </Button>
            )}
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="panel p-6 sm:p-8">
            {finished ? (
              <div className="py-6 text-center">
                <Trophy className="mx-auto h-12 w-12 text-primary" />
                <h1 className="mt-4 text-3xl font-black">{data?.room.winnerName} kazandı!</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data?.room.targetScore} puana ilk ulaşan o oldu.
                </p>
                <Button className="mt-6 h-11 font-bold" onClick={handleReset}>
                  Yeni oyun başlat
                </Button>
              </div>
            ) : roundActive ? (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{round!.roundNo}. tur çalıyor</p>
                  <p className="font-display text-3xl font-black text-primary">{remaining}</p>
                </div>
                <div className="mt-6 flex h-24 items-end justify-center gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                    <span
                      key={i}
                      className="eq-bar"
                      style={{ animationDelay: `${(i % 6) * 0.12}s` }}
                    />
                  ))}
                </div>
                <div className="mt-8">
                  <Label htmlFor="guess">Şarkının adı ne?</Label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="guess"
                      autoFocus
                      autoComplete="off"
                      value={guess}
                      maxLength={80}
                      placeholder="Şarkı adını yaz ve gönder"
                      className="h-12"
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                    />
                    <Button className="h-12 px-6 font-bold" disabled={sending} onClick={handleGuess}>
                      Gönder
                    </Button>
                  </div>
                  {feedback === "wrong" && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
                      <X className="h-4 w-4" /> Olmadı, tekrar dene
                    </p>
                  )}
                  {feedback === "correct" && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-primary">
                      <Check className="h-4 w-4" /> Doğru! +10 puan
                    </p>
                  )}
                </div>
              </div>
            ) : round ? (
              <div className="text-center">
                {round.artworkUrl && (
                  <img
                    src={round.artworkUrl}
                    alt={`${round.trackName} albüm kapağı`}
                    className="mx-auto h-32 w-32 rounded-xl object-cover"
                  />
                )}
                <p className="mt-5 text-xs tracking-widest text-muted-foreground">
                  {round.winnerName ? `${round.winnerName.toUpperCase()} BİLDİ` : "KİMSE BİLEMEDİ"}
                </p>
                <h2 className="mt-2 text-2xl font-black">{round.trackName}</h2>
                <p className="text-sm text-muted-foreground">{round.artistName}</p>
                <Button className="mt-7 h-12 px-7 font-bold" onClick={handleStart}>
                  <Play className="mr-2 h-4 w-4" /> Sıradaki şarkı
                </Button>
              </div>
            ) : (
              <div className="py-8 text-center">
                <h1 className="text-2xl font-black">Herkes hazır mı?</h1>
                <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                  Kodu paylaş, arkadaşların katılsın. Şarkı çaldığında adını ilk doğru yazan 10 puan
                  alır; {data?.room.targetScore} puana ulaşan kazanır.
                </p>
                <Button className="mt-7 h-12 px-7 font-bold" onClick={handleStart}>
                  <Play className="mr-2 h-4 w-4" /> Oyunu başlat
                </Button>
              </div>
            )}
            {actionError && <p className="mt-4 text-sm text-destructive">{actionError}</p>}
          </section>

          <aside className="space-y-6">
            <div className="panel p-5">
              <h2 className="text-sm tracking-widest text-muted-foreground">
                SIRALAMA · HEDEF {data?.room.targetScore}
              </h2>
              <ul className="mt-4 space-y-2">
                {(data?.players ?? []).map((p) => (
                  <li
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                      p.id === me?.id ? "bg-accent" : "bg-secondary"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {leader && p.id === leader.id && p.score > 0 && (
                        <Crown className="h-4 w-4 text-primary" />
                      )}
                      {p.name}
                    </span>
                    <span className="font-display font-bold">{p.score}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel p-5">
              <h2 className="text-sm tracking-widest text-muted-foreground">CEVAPLAR</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {(data?.guesses ?? []).length === 0 && (
                  <li className="text-muted-foreground">Henüz cevap yok.</li>
                )}
                {(data?.guesses ?? []).map((g) => (
                  <li key={g.id} className="flex items-center gap-2">
                    {g.correct ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="font-medium">{g.player_name}</span>
                    <span className="truncate text-muted-foreground">
                      {g.correct && !round?.ended ? "doğru cevabı yazdı" : g.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
