"""
Auto-updater for ScreenPrompt.
Checks GitHub releases for updates and handles download/install.
"""

import json
import os
import sys
import tempfile
import threading
import urllib.request
import urllib.error
from typing import Optional, Callable

# GitHub repository info
GITHUB_REPO = "dan0dev/ScreenPrompt"
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

# Current version (read from version.txt or fallback)
def get_current_version() -> str:
    """Get current application version."""
    try:
        # Try to find version.txt in common locations
        version_paths = [
            os.path.join(os.path.dirname(__file__), '..', 'version.txt'),
            os.path.join(os.path.dirname(__file__), 'version.txt'),
        ]

        # When running as frozen exe
        if hasattr(sys, '_MEIPASS'):
            version_paths.insert(0, os.path.join(sys._MEIPASS, 'version.txt'))

        for path in version_paths:
            if os.path.exists(path):
                with open(path, 'r') as f:
                    return f.read().strip()
    except Exception:
        pass

    return "1.0.0"  # Fallback


def parse_version(version_str: str) -> tuple:
    """Parse version string into comparable tuple."""
    # Remove 'v' prefix if present
    version_str = version_str.lstrip('v')

    # Split and convert to integers
    try:
        parts = version_str.split('.')
        return tuple(int(p) for p in parts)
    except (ValueError, AttributeError):
        return (0, 0, 0)


def is_newer_version(latest: str, current: str) -> bool:
    """Check if latest version is newer than current."""
    return parse_version(latest) > parse_version(current)


class UpdateChecker:
    """Handles checking for and downloading updates."""

    def __init__(self):
        self.latest_version: Optional[str] = None
        self.download_url: Optional[str] = None
        self.release_notes: Optional[str] = None
        self.downloaded_path: Optional[str] = None
        self._download_progress: float = 0
        self._is_downloading: bool = False

    def check_for_updates(self) -> tuple[bool, Optional[str], Optional[str]]:
        """
        Check GitHub for updates.

        Returns:
            tuple: (update_available, latest_version, release_notes)
        """
        try:
            # Create request with headers (GitHub API requires User-Agent)
            request = urllib.request.Request(
                GITHUB_API_URL,
                headers={
                    'User-Agent': 'ScreenPrompt-Updater',
                    'Accept': 'application/vnd.github.v3+json'
                }
            )

            with urllib.request.urlopen(request, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))

            self.latest_version = data.get('tag_name', '').lstrip('v')
            self.release_notes = data.get('body', '')

            # Find the installer asset
            assets = data.get('assets', [])
            for asset in assets:
                name = asset.get('name', '').lower()
                if name.endswith('-setup.exe'):
                    self.download_url = asset.get('browser_download_url')
                    break

            current_version = get_current_version()
            update_available = is_newer_version(self.latest_version, current_version)

            return update_available, self.latest_version, self.release_notes

        except urllib.error.URLError as e:
            # Network error - silently fail
            return False, None, None
        except Exception as e:
            # Other errors - silently fail
            return False, None, None

    def download_update(self, progress_callback: Optional[Callable[[float], None]] = None) -> Optional[str]:
        """
        Download the update installer.

        Args:
            progress_callback: Optional callback with progress (0.0 to 1.0)

        Returns:
            Path to downloaded installer, or None on failure
        """
        if not self.download_url:
            return None

        self._is_downloading = True
        self._download_progress = 0

        try:
            # Create temp directory for download
            temp_dir = tempfile.mkdtemp(prefix='screenprompt_update_')
            filename = f"ScreenPrompt-{self.latest_version}-Setup.exe"
            download_path = os.path.join(temp_dir, filename)

            # Create request
            request = urllib.request.Request(
                self.download_url,
                headers={'User-Agent': 'ScreenPrompt-Updater'}
            )

            with urllib.request.urlopen(request, timeout=60) as response:
                total_size = int(response.headers.get('content-length', 0))
                downloaded = 0
                block_size = 8192

                with open(download_path, 'wb') as f:
                    while True:
                        block = response.read(block_size)
                        if not block:
                            break

                        f.write(block)
                        downloaded += len(block)

                        if total_size > 0:
                            self._download_progress = downloaded / total_size
                            if progress_callback:
                                progress_callback(self._download_progress)

            self.downloaded_path = download_path
            return download_path

        except Exception as e:
            return None
        finally:
            self._is_downloading = False

    def download_update_async(
        self,
        progress_callback: Optional[Callable[[float], None]] = None,
        complete_callback: Optional[Callable[[Optional[str]], None]] = None
    ) -> None:
        """
        Download update in background thread.

        Args:
            progress_callback: Called with progress (0.0 to 1.0)
            complete_callback: Called with download path (or None on failure)
        """
        def _download():
            result = self.download_update(progress_callback)
            if complete_callback:
                complete_callback(result)

        thread = threading.Thread(target=_download, daemon=True)
        thread.start()

    def install_update(self) -> bool:
        """
        Launch the downloaded installer and exit the application.

        Returns:
            True if installer was launched successfully
        """
        if not self.downloaded_path or not os.path.exists(self.downloaded_path):
            return False

        try:
            # Launch installer
            if sys.platform == 'win32':
                os.startfile(self.downloaded_path)
            else:
                return False  # Only Windows supported

            return True

        except Exception as e:
            return False

    @property
    def is_downloading(self) -> bool:
        return self._is_downloading

    @property
    def download_progress(self) -> float:
        return self._download_progress


# Singleton instance
_updater: Optional[UpdateChecker] = None


def get_updater() -> UpdateChecker:
    """Get the global UpdateChecker instance."""
    global _updater
    if _updater is None:
        _updater = UpdateChecker()
    return _updater


def check_for_updates_sync() -> tuple[bool, Optional[str], Optional[str]]:
    """Convenience function to check for updates synchronously."""
    return get_updater().check_for_updates()


def check_for_updates_async(callback: Callable[[bool, Optional[str], Optional[str]], None]) -> None:
    """
    Check for updates in background thread.

    Args:
        callback: Called with (update_available, latest_version, release_notes)
    """
    def _check():
        result = get_updater().check_for_updates()
        callback(*result)

    thread = threading.Thread(target=_check, daemon=True)
    thread.start()
