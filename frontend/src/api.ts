import type { CollectionMeme, Meme, RankingMeme, RevealResponse, SnatchResponse, VoteSyncResponse } from "./types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

const isTauri = () => typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function fetchMemes(excludeSeen = false) {
  const limit = 120;
  if (isTauri()) {
    return invokeTauri<Meme[]>("get_memes", { limit, excludeSeen });
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (excludeSeen) params.set("exclude_seen", "true");
  return request<Meme[]>(`/api/memes?${params}`);
}

export function createSnatch(meme: Meme, timingScore: number) {
  const source = meme.platform[0] || "架空SNS";
  const payload = {
    meme_id: meme.id,
    source_area: source,
    timing_score: timingScore,
  };
  if (isTauri()) {
    return invokeTauri<SnatchResponse>("create_snatch", { payload });
  }
  return request<SnatchResponse>("/api/snatches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createReveal(snatchId: string, revealedRatio: number) {
  const payload = {
    snatch_id: snatchId,
    revealed_ratio: revealedRatio,
  };
  if (isTauri()) {
    return invokeTauri<RevealResponse>("create_reveal", { payload });
  }
  return request<RevealResponse>("/api/reveals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function syncVotes() {
  if (isTauri()) {
    return invokeTauri<VoteSyncResponse>("sync_votes");
  }
  return request<VoteSyncResponse>("/api/votes/sync", {
    method: "POST",
  });
}

export function fetchCollection() {
  if (isTauri()) {
    return invokeTauri<CollectionMeme[]>("get_collection");
  }
  return request<CollectionMeme[]>("/api/collection");
}

export function fetchRanking() {
  if (isTauri()) {
    return invokeTauri<RankingMeme[]>("get_ranking");
  }
  return request<RankingMeme[]>("/api/ranking");
}
