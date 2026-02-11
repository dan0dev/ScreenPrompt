// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { tempDir, join } from '@tauri-apps/api/path';
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { exit } from '@tauri-apps/plugin-process';
import { confirm } from '@tauri-apps/plugin-dialog';
import { checkForUpdates } from '../utils/updateChecker';

const APP_VERSION = '1.1.0';

interface UpdaterState {
  checked: boolean; // true once the update check has completed
  updateAvailable: boolean;
  updateVersion: string;
  downloadUrl: string | null;
  downloading: boolean;
}

export function useUpdater(autoCheck: boolean) {
  const [state, setState] = useState<UpdaterState>({
    checked: false,
    updateAvailable: false,
    updateVersion: '',
    downloadUrl: null,
    downloading: false,
  });

  // Check for updates and auto-prompt the user
  useEffect(() => {
    if (!autoCheck) return;

    const checkAndPrompt = async () => {
      const info = await checkForUpdates(APP_VERSION);

      if (!info.updateAvailable || !info.downloadUrl) {
        setState((s) => ({ ...s, checked: true }));
        return;
      }

      setState({
        checked: true,
        updateAvailable: true,
        updateVersion: info.latestVersion,
        downloadUrl: info.downloadUrl,
        downloading: false,
      });

      // Auto-popup the update dialog
      const yes = await confirm(
        `A new version (v${info.latestVersion}) is available.\n\nDownload and install now?`,
        { title: 'ScreenPrompt Update', kind: 'info' },
      );

      if (yes) {
        await doDownloadAndInstall(info.downloadUrl, info.latestVersion);
      }
    };

    checkAndPrompt();
  }, [autoCheck]);

  const doDownloadAndInstall = async (url: string, version: string) => {
    setState((s) => ({ ...s, downloading: true }));

    try {
      // 1. Download the installer
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());

      // 2. Save to temp directory
      const filename = `ScreenPrompt-${version}-setup.exe`;
      await writeFile(filename, bytes, { baseDir: BaseDirectory.Temp });

      // 3. Build full path and launch installer
      const tmp = await tempDir();
      const fullPath = await join(tmp, filename);
      await invoke('launch_update_installer', { path: fullPath });

      // 4. Close the app so the installer can overwrite it
      await exit(0);
    } catch (error) {
      console.error('Update failed:', error);
      setState((s) => ({ ...s, downloading: false }));
    }
  };

  const downloadAndInstall = useCallback(async () => {
    if (!state.downloadUrl) return;
    await doDownloadAndInstall(state.downloadUrl, state.updateVersion);
  }, [state.downloadUrl, state.updateVersion]);

  return {
    ...state,
    downloadAndInstall,
    appVersion: APP_VERSION,
  };
}
