import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ROUND_SECONDS = 30;
const POINTS = 10;

const nameSchema = z
  .string()
  .trim()
  .min(2, "İsim en az 2 karakter olmalı")
  .max(20, "İsim en fazla 20 karakter olabilir");

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{4}$/, "Oda kodu 4 karakter olmalı");

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; targetScore: number; mode?: string }) =>
    z
      .object({
        name: nameSchema,
        targetScore: z.number().int().min(10).max(200),
        mode: z.enum(["music", "screen", "mixed"]).default("music"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { makeRoomCode } = await import("./game.server");

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = makeRoomCode();
      const { data: room, error } = await supabaseAdmin
        .from("rooms")
        .insert({ code, target_score: data.targetScore, mode: data.mode })
        .select("id, code")
        .single();
      if (error) continue;

      const { data: player, error: playerError } = await supabaseAdmin
        .from("players")
        .insert({ room_id: room.id, name: data.name, is_host: true })
        .select("id")
        .single();
      if (playerError) throw new Error("Oyuncu oluşturulamadı");

      return { code: room.code, playerId: player.id };
    }
    throw new Error("Oda oluşturulamadı, tekrar dene");
  });

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; name: string }) =>
    z.object({ code: codeSchema, name: nameSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("code", data.code)
      .maybeSingle();
    if (!room) throw new Error("Böyle bir oda yok");

    const { data: existing } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("room_id", room.id)
      .eq("name", data.name)
      .maybeSingle();
    if (existing) return { code: data.code, playerId: existing.id };

    const { data: player, error } = await supabaseAdmin
      .from("players")
      .insert({ room_id: room.id, name: data.name })
      .select("id")
      .single();
    if (error) throw new Error("Odaya katılamadın, farklı bir isim dene");

    return { code: data.code, playerId: player.id };
  });

export const getRoomState = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; playerId?: string | null }) =>
    z.object({ code: codeSchema, playerId: z.string().uuid().nullish() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, code, target_score, status, winner_name, mode")
      .eq("code", data.code)
      .maybeSingle();
    if (!room) throw new Error("Böyle bir oda yok");

    if (data.playerId) {
      await supabaseAdmin
        .from("players")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", data.playerId)
        .eq("room_id", room.id);
    }

    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id, name, score, is_host")
      .eq("room_id", room.id)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true });

    const { data: round } = await supabaseAdmin
      .from("rounds")
      .select("*")
      .eq("room_id", room.id)
      .order("round_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    let current = round;
    if (current && !current.ended && new Date(current.ends_at).getTime() <= Date.now()) {
      const { data: closed } = await supabaseAdmin
        .from("rounds")
        .update({ ended: true })
        .eq("id", current.id)
        .select("*")
        .single();
      current = closed ?? current;
    }

    let guesses: { player_name: string; text: string; correct: boolean; id: string }[] = [];
    if (current) {
      const { data: rows } = await supabaseAdmin
        .from("guesses")
        .select("id, player_name, text, correct")
        .eq("round_id", current.id)
        .order("created_at", { ascending: false })
        .limit(10);
      guesses = rows ?? [];
    }

    const winnerName = current?.winner_player_id
      ? ((players ?? []).find((p) => p.id === current!.winner_player_id)?.name ?? null)
      : null;

    return {
      serverNow: Date.now(),
      room: {
        code: room.code,
        targetScore: room.target_score,
        status: room.status,
        winnerName: room.winner_name,
        mode: room.mode,
      },
      players: (players ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isHost: p.is_host,
      })),
      me: (players ?? []).find((p) => p.id === data.playerId) ?? null,
      round: current
        ? {
            id: current.id,
            roundNo: current.round_no,
            kind: current.kind,
            previewUrl: current.preview_url,
            startedAt: current.started_at,
            endsAt: current.ends_at,
            ended: current.ended,
            winnerName,
            // answer is only ever sent after the round is over
            trackName: current.ended ? current.track_name : null,
            artistName: current.ended ? current.artist_name : null,
            artworkUrl: current.ended ? current.artwork_url : null,
          }
        : null,
      guesses,
    };
  });

export const startRound = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; playerId: string }) =>
    z.object({ code: codeSchema, playerId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pickRandomTrack } = await import("./game.server");

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, status")
      .eq("code", data.code)
      .maybeSingle();
    if (!room) throw new Error("Böyle bir oda yok");
    if (room.status === "finished") throw new Error("Oyun bitti, yeni oyun başlat");

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("id", data.playerId)
      .eq("room_id", room.id)
      .maybeSingle();
    if (!player) throw new Error("Bu odada değilsin");

    const { data: last } = await supabaseAdmin
      .from("rounds")
      .select("id, round_no, ended, ends_at")
      .eq("room_id", room.id)
      .order("round_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last && !last.ended && new Date(last.ends_at).getTime() > Date.now()) {
      return { ok: true, roundId: last.id };
    }

    const track = await pickRandomTrack(room.id);
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + ROUND_SECONDS * 1000);

    const { data: round, error } = await supabaseAdmin
      .from("rounds")
      .insert({
        room_id: room.id,
        round_no: (last?.round_no ?? 0) + 1,
        track_name: track.track_name,
        artist_name: track.artist_name,
        preview_url: track.preview_url,
        artwork_url: track.artwork_url,
        started_at: startedAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error("Tur başlatılamadı");

    if (room.status !== "playing") {
      await supabaseAdmin.from("rooms").update({ status: "playing" }).eq("id", room.id);
    }

    return { ok: true, roundId: round.id };
  });

export const submitGuess = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; playerId: string; guess: string }) =>
    z
      .object({
        code: codeSchema,
        playerId: z.string().uuid(),
        guess: z.string().trim().min(1).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isCorrectGuess } = await import("./game.server");

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, target_score, status")
      .eq("code", data.code)
      .maybeSingle();
    if (!room) throw new Error("Böyle bir oda yok");

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id, name, score")
      .eq("id", data.playerId)
      .eq("room_id", room.id)
      .maybeSingle();
    if (!player) throw new Error("Bu odada değilsin");

    const { data: round } = await supabaseAdmin
      .from("rounds")
      .select("id, track_name, ended, ends_at, winner_player_id")
      .eq("room_id", room.id)
      .order("round_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!round) throw new Error("Aktif tur yok");
    if (round.ended || round.winner_player_id || new Date(round.ends_at).getTime() <= Date.now()) {
      return { correct: false, tooLate: true };
    }

    const correct = isCorrectGuess(data.guess, round.track_name);

    await supabaseAdmin.from("guesses").insert({
      round_id: round.id,
      player_id: player.id,
      player_name: player.name,
      text: data.guess,
      correct,
    });

    if (!correct) return { correct: false, tooLate: false };

    // first correct guess wins the round
    const { data: claimed } = await supabaseAdmin
      .from("rounds")
      .update({ winner_player_id: player.id, ended: true })
      .eq("id", round.id)
      .is("winner_player_id", null)
      .eq("ended", false)
      .select("id")
      .maybeSingle();

    if (!claimed) return { correct: true, tooLate: true };

    const newScore = player.score + POINTS;
    await supabaseAdmin.from("players").update({ score: newScore }).eq("id", player.id);

    if (newScore >= room.target_score) {
      await supabaseAdmin
        .from("rooms")
        .update({ status: "finished", winner_name: player.name })
        .eq("id", room.id);
    }

    return { correct: true, tooLate: false, points: POINTS };
  });

export const resetGame = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string; playerId: string }) =>
    z.object({ code: codeSchema, playerId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id")
      .eq("code", data.code)
      .maybeSingle();
    if (!room) throw new Error("Böyle bir oda yok");

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("id", data.playerId)
      .eq("room_id", room.id)
      .maybeSingle();
    if (!player) throw new Error("Bu odada değilsin");

    await supabaseAdmin.from("rounds").delete().eq("room_id", room.id);
    await supabaseAdmin.from("players").update({ score: 0 }).eq("room_id", room.id);
    await supabaseAdmin
      .from("rooms")
      .update({ status: "lobby", winner_name: null })
      .eq("id", room.id);

    return { ok: true };
  });
