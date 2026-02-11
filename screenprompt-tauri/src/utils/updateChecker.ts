// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

const GITHUB_API_URL =
  'https://api.github.com/repos/dan0dev/ScreenPrompt/releases/latest';

export interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion: string;
  downloadUrl: string | null;
  releaseNotes: string;
}

export function parseVersion(str: string): number[] {
  return str
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

export function isNewerVersion(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] || 0;
    const cv = c[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export async function checkForUpdates(
  currentVersion: string,
): Promise<UpdateInfo> {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const release = await response.json();
    const latestVersion: string = (release.tag_name || '').replace(/^v/, '');
    const updateAvailable = isNewerVersion(latestVersion, currentVersion);

    // Find setup exe asset (case-insensitive, matching Python logic)
    let downloadUrl: string | null = null;
    if (release.assets && Array.isArray(release.assets)) {
      const setupAsset = release.assets.find((a: { name: string }) =>
        a.name.toLowerCase().endsWith('-setup.exe'),
      );
      if (setupAsset) {
        downloadUrl = setupAsset.browser_download_url;
      }
    }

    return {
      updateAvailable,
      latestVersion,
      downloadUrl,
      releaseNotes: release.body || '',
    };
  } catch (error) {
    console.error('Update check failed:', error);
    return {
      updateAvailable: false,
      latestVersion: currentVersion,
      downloadUrl: null,
      releaseNotes: '',
    };
  }
}
