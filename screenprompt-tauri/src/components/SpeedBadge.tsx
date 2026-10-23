// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { linesPerMinute } from '../utils/autoScroll';
import '../styles/SpeedBadge.css';

/** Brief "Speed 5" badge over the notes when the auto-scroll speed changes */
function SpeedBadge({ speed }: { speed: number }) {
  return (
    // Keyed by speed so each change replays the fade-in
    <div className="speed-badge" role="status" key={speed}>
      <strong>Speed {speed}</strong>
      <span>{linesPerMinute(speed)} lines/min</span>
    </div>
  );
}

export default SpeedBadge;
