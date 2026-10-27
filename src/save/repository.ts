// Versioned local save with a recoverable backup. Play continues if storage is unavailable.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Settings {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
}

export interface SaveData {
  version: 1;
  bestByMode: { normal: number };
  coins: number;
  ownedCosmetics: string[];
  equippedCosmetics: { ball: string };
  settings: Settings;
  tutorialSeen: boolean;
  lastSettledRunId: string | null;
}

export interface Settlement {
  coinsAwarded: number;
  best: number;
  newBest: boolean;
  alreadySettled: boolean;
}

const KEY = 'pocket-ricochet/save';
const BACKUP_KEY = 'pocket-ricochet/save.backup';

export function defaultSave(): SaveData {
  return {
    version: 1,
    bestByMode: { normal: 0 },
    coins: 0,
    ownedCosmetics: ['ball:red'],
    equippedCosmetics: { ball: 'ball:red' },
    settings: { sound: true, haptics: true, reducedMotion: false },
    tutorialSeen: false,
    lastSettledRunId: null,
  };
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1e9;

export function parseSave(text: string | null): SaveData | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, any>;
  if (r.version !== 1) return null;
  if (!r.bestByMode || !isCount(r.bestByMode.normal)) return null;
  if (!isCount(r.coins)) return null;
  if (!Array.isArray(r.ownedCosmetics) || r.ownedCosmetics.some((c: unknown) => typeof c !== 'string')) return null;
  if (!r.equippedCosmetics || typeof r.equippedCosmetics.ball !== 'string') return null;
  const s = r.settings;
  if (!s || typeof s.sound !== 'boolean' || typeof s.haptics !== 'boolean' || typeof s.reducedMotion !== 'boolean') return null;
  if (typeof r.tutorialSeen !== 'boolean') return null;
  if (r.lastSettledRunId !== null && typeof r.lastSettledRunId !== 'string') return null;
  return {
    version: 1,
    bestByMode: { normal: r.bestByMode.normal },
    coins: r.coins,
    ownedCosmetics: [...r.ownedCosmetics],
    equippedCosmetics: { ball: r.equippedCosmetics.ball },
    settings: { sound: s.sound, haptics: s.haptics, reducedMotion: s.reducedMotion },
    tutorialSeen: r.tutorialSeen,
    lastSettledRunId: r.lastSettledRunId,
  };
}

export class SaveRepository {
  data: SaveData;
  /** False when storage is missing or a write failed; the UI shows a small notice. */
  available: boolean;

  constructor(private readonly storage: StorageLike | null) {
    this.available = storage !== null;
    this.data = this.load();
  }

  static fromBrowser(): SaveRepository {
    try {
      const storage = window.localStorage;
      const probe = `${KEY}.probe`;
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return new SaveRepository(storage);
    } catch {
      return new SaveRepository(null);
    }
  }

  private load(): SaveData {
    if (!this.storage) return defaultSave();
    try {
      return parseSave(this.storage.getItem(KEY)) ?? parseSave(this.storage.getItem(BACKUP_KEY)) ?? defaultSave();
    } catch {
      this.available = false;
      return defaultSave();
    }
  }

  persist(): void {
    if (!this.storage) return;
    try {
      const previous = this.storage.getItem(KEY);
      if (previous && parseSave(previous)) this.storage.setItem(BACKUP_KEY, previous);
      this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      this.available = false;
    }
  }

  /** Award a finished run once. Calling again with the same run ID pays nothing. */
  settleRun(runId: string, banked: number, coins: number): Settlement {
    if (this.data.lastSettledRunId === runId) {
      return { coinsAwarded: 0, best: this.data.bestByMode.normal, newBest: false, alreadySettled: true };
    }
    const newBest = banked > this.data.bestByMode.normal;
    if (newBest) this.data.bestByMode.normal = banked;
    this.data.coins += coins;
    this.data.lastSettledRunId = runId;
    this.persist();
    return { coinsAwarded: coins, best: this.data.bestByMode.normal, newBest, alreadySettled: false };
  }

  setTutorialSeen(seen: boolean): void {
    if (this.data.tutorialSeen === seen) return;
    this.data.tutorialSeen = seen;
    this.persist();
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.persist();
  }
}

export class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}
