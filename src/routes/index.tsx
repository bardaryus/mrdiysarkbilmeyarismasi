import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Music4, Users, Trophy, Loader2 } from "lucide-react";

import { createRoom, joinRoom } from "@/lib/game.functions";
import { savePlayerId } from "@/lib/player-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Şarkı Bil — Ofisin müzik yarışması" },
      {
        name: "description",
        content:
          "Türkiye listelerinden şarkılar çalar, adını ilk doğru yazan 10 puan alır. Oda kodunu paylaş, arkadaşların anında katılsın.",
      },
      { property: "og:title", content: "Şarkı Bil — Ofisin müzik yarışması" },
      {
        property: "og:description",
        content: "Oda kur, şarkı çalsın, ilk bilen kazansın.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const join = useServerFn(joinRoom);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [target, setTarget] = useState(50);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const message = (e: unknown) =>
    e instanceof Error && e.message ? e.message : "Bir şeyler ters gitti, tekrar dene";

  async function handleCreate() {
    setError(null);
    setBusy("create");
    try {
      const res = await create({ data: { name: name.trim(), targetScore: target } });
      savePlayerId(res.code, res.playerId);
      navigate({ to: "/oda/$code", params: { code: res.code } });
    } catch (e) {
      setError(message(e));
      setBusy(null);
    }
  }

  async function handleJoin() {
    setError(null);
    setBusy("join");
    try {
      const res = await join({ data: { code: code.trim().toUpperCase(), name: name.trim() } });
      savePlayerId(res.code, res.playerId);
      navigate({ to: "/oda/$code", params: { code: res.code } });
    } catch (e) {
      setError(message(e));
      setBusy(null);
    }
  }

  return (
    <main className="stage-bg min-h-screen px-5 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
          <span className="glow-ring flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Music4 className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Şarkı Bil</span>
        </header>

        <section className="mt-14 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h1 className="text-5xl leading-[1.05] font-black sm:text-6xl">
              Şarkı çalar,
              <br />
              <span className="text-primary">ilk bilen kazanır.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Türkiye'de en çok dinlenen şarkılardan rastgele 30 saniyelik parçalar çalar. Şarkının
              adını ilk doğru yazan 10 puan alır. Hedef puana ulaşan oyunu kazanır.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-3">
                <Users className="h-4 w-4 text-primary" /> Oda kodu ve takma ad yeter, kayıt yok
              </li>
              <li className="flex items-center gap-3">
                <Trophy className="h-4 w-4 text-primary" /> Her tur 30 saniye, doğru cevap 10 puan
              </li>
            </ul>
          </div>

          <div className="panel p-6 sm:p-8">
            <div className="space-y-2">
              <Label htmlFor="name">Takma adın</Label>
              <Input
                id="name"
                value={name}
                maxLength={20}
                placeholder="Örn. Barış"
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="mt-7 space-y-2">
              <Label htmlFor="target">Kazanmak için gereken puan</Label>
              <div className="flex gap-2">
                {[30, 50, 100].map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={target === v ? "default" : "secondary"}
                    className="flex-1"
                    onClick={() => setTarget(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
              <Button
                className="mt-3 h-12 w-full text-base font-bold"
                disabled={busy !== null || name.trim().length < 2}
                onClick={handleCreate}
              >
                {busy === "create" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Oda kur
              </Button>
            </div>

            <div className="my-7 flex items-center gap-3 text-xs tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> VEYA <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Oda kodu ile katıl</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={code}
                  maxLength={4}
                  placeholder="ABCD"
                  className="font-display text-center text-lg tracking-[0.4em] uppercase"
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <Button
                  variant="secondary"
                  className="h-10 px-6 font-semibold"
                  disabled={busy !== null || name.trim().length < 2 || code.trim().length !== 4}
                  onClick={handleJoin}
                >
                  {busy === "join" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Katıl
                </Button>
              </div>
            </div>

            {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
