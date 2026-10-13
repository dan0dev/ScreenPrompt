// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useState, useEffect, useCallback, useRef } from 'react';
import { load } from '@tauri-apps/plugin-store';
import type { Config } from '../types';
import { DEFAULT_CONFIG } from '../types';

const STORE_FILE = 'config.json';

export function useConfig() {
  const [config, setConfigState] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  // Load config from store
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const store = await load(STORE_FILE);

        const loaded: Partial<Config> = {};
        for (const key of Object.keys(DEFAULT_CONFIG)) {
          const value = await store.get(key);
          if (value !== null && value !== undefined) {
            (loaded as any)[key] = value;
          }
        }

        // Merge with defaults
        setConfigState({ ...DEFAULT_CONFIG, ...loaded });
      } catch (error) {
        console.error('Failed to load config:', error);
        setConfigState(DEFAULT_CONFIG);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Save config to store. Stable and merges into the latest state, so callers in
  // long-lived listeners (window move/resize) can't overwrite newer changes.
  // Saves run one at a time: each writes the whole file, so an older save
  // finishing last could otherwise undo a newer one.
  const setConfig = useCallback(async (updates: Partial<Config>) => {
    setConfigState((prev) => ({ ...prev, ...updates }));

    const save = saveQueue.current.then(async () => {
      const store = await load(STORE_FILE);
      for (const [key, value] of Object.entries(updates)) {
        await store.set(key, value);
      }
      await store.save();
    });
    saveQueue.current = save.catch(() => {});

    try {
      await save;
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }, []);

  return { config, setConfig, loading };
}
