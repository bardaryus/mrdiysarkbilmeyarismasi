const key = (code: string) => `sarkibil:player:${code.toUpperCase()}`;

export function savePlayerId(code: string, playerId: string) {
  try {
    localStorage.setItem(key(code), playerId);
  } catch {
    /* storage unavailable */
  }
}

export function loadPlayerId(code: string): string | null {
  try {
    return localStorage.getItem(key(code));
  } catch {
    return null;
  }
}

export function clearPlayerId(code: string) {
  try {
    localStorage.removeItem(key(code));
  } catch {
    /* storage unavailable */
  }
}
