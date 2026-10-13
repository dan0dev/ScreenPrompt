// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import '../styles/LockTip.css';

/**
 * One-time explanation of locked mode, shown over the notes the first time the
 * user locks the overlay (see `lockTipShown` in the config). It can't be clicked
 * while locked, so App hides it on a timer or when the overlay unlocks.
 */
function LockTip() {
  return (
    <div className="lock-tip" role="status">
      <strong>Locked: clicks go through to the app below.</strong>
      <span>Scrolling works on the app behind too. Ctrl+scroll here moves your notes.</span>
      <span>Unlock: press Esc, or Ctrl+click the lock icon.</span>
    </div>
  );
}

export default LockTip;
