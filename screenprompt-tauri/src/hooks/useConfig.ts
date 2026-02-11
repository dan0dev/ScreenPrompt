// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useState, useEffect } from 'react';
import { load } from '@tauri-apps/plugin-store';
import type { Config } from '../types';
import { DEFAULT_CONFIG } from '../types';

const STORE_FILE = 'config.json';

export function useConfig() {
  const [config, setConfigState] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

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

  // Save config to store
  const setConfig = async (updates: Partial<Config>) => {
    try {
      const newConfig = { ...config, ...updates };
      setConfigState(newConfig);

      const store = await load(STORE_FILE);
      for (const [key, value] of Object.entries(updates)) {
        await store.set(key, value);
      }
      await store.save();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  return { config, setConfig, loading };
}
