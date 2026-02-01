# ScreenPrompt Manual Test Checklist

## Prerequisites

- Windows 10 Build 2004+ or Windows 11
- ScreenPrompt installed and running
- Access to screen sharing applications (Zoom, Teams, OBS)

---

## Test 1: Zoom Screen Share Exclusion

**Objective:** Verify overlay is invisible during Zoom screen share.

**Steps:**
1. Launch ScreenPrompt with visible text
2. Open Zoom and start a meeting (can be solo)
3. Click "Share Screen" and select your desktop or monitor
4. Look at the shared screen preview in Zoom

**Expected Result:**
- [ ] Overlay text is visible on your actual screen
- [ ] Overlay is NOT visible in Zoom's shared view
- [ ] No black rectangle or artifact where overlay was

**Notes:** _______________________________

---

## Test 2: Microsoft Teams Screen Share Exclusion

**Objective:** Verify overlay is invisible during Teams screen share.

**Steps:**
1. Launch ScreenPrompt with visible text
2. Open Teams and start a call/meeting
3. Click "Share" and select screen/window
4. Check the "sharing indicator" or ask a participant to confirm

**Expected Result:**
- [ ] Overlay visible on local screen
- [ ] Overlay NOT visible to meeting participants
- [ ] No visual glitches in shared content

**Notes:** _______________________________

---

## Test 3: OBS Display Capture Exclusion

**Objective:** Verify overlay is invisible in OBS recordings/streams.

**Steps:**
1. Launch ScreenPrompt with visible text
2. Open OBS Studio
3. Add a "Display Capture" source
4. Check the OBS preview window

**Expected Result:**
- [ ] Overlay visible on actual display
- [ ] Overlay NOT visible in OBS preview
- [ ] Recording/stream does not show overlay

**Notes:** _______________________________

---

## Test 4: Windows Snipping Tool Exclusion

**Objective:** Verify overlay is invisible in screenshots.

**Steps:**
1. Launch ScreenPrompt with visible text positioned clearly
2. Press Win+Shift+S to open Snipping Tool
3. Select an area that includes the overlay
4. Paste screenshot (Ctrl+V) into Paint or similar

**Expected Result:**
- [ ] Overlay visible on screen during selection
- [ ] Overlay NOT visible in captured screenshot
- [ ] No black rectangle or artifact in screenshot

**Notes:** _______________________________

---

## Test 5: Multi-Monitor Drag Behavior

**Objective:** Verify overlay can be dragged across monitors.

**Prerequisites:** Multi-monitor setup required

**Steps:**
1. Launch ScreenPrompt on primary monitor
2. Drag overlay window to secondary monitor
3. Release and verify position
4. Close and reopen ScreenPrompt

**Expected Result:**
- [ ] Overlay drags smoothly between monitors
- [ ] No visual glitches during drag
- [ ] Position is saved correctly
- [ ] Overlay reappears on correct monitor after restart
- [ ] Capture exclusion works on all monitors

**Notes:** _______________________________

---

## Test 6: Ethical Popup on First Run

**Objective:** Verify first-run ethical warning displays correctly.

**Steps:**
1. Delete config file: `%APPDATA%\ScreenPrompt\config.json`
2. Launch ScreenPrompt fresh
3. Read the popup message
4. Click acknowledgment button

**Expected Result:**
- [ ] Popup appears before main window
- [ ] Message includes "legitimate use" language
- [ ] Message includes "DO NOT use for cheating" warning
- [ ] Message includes "solely responsible" disclaimer
- [ ] Main window only appears after acknowledgment
- [ ] Popup does NOT appear on subsequent launches

**Popup Text Verification:**
- [ ] Mentions: presentations, meetings, content creation
- [ ] Warns against: exams, policy violations, ToS violations
- [ ] States: user responsibility for usage

**Notes:** _______________________________

---

## Test 7: Settings Persistence

**Objective:** Verify settings are saved and restored correctly.

**Steps:**
1. Launch ScreenPrompt
2. Change opacity to 0.7
3. Change font size to 18
4. Move window to specific position
5. Close ScreenPrompt
6. Reopen ScreenPrompt

**Expected Result:**
- [ ] Opacity restored to 0.7
- [ ] Font size restored to 18
- [ ] Window position restored
- [ ] All other settings preserved

**Notes:** _______________________________

---

## Test 8: Opacity Range

**Objective:** Verify opacity slider respects 0.5-1.0 range.

**Steps:**
1. Open Settings dialog
2. Try to set opacity below 0.5
3. Try to set opacity above 1.0
4. Set opacity to 0.5 and verify readability

**Expected Result:**
- [ ] Slider minimum is 0.5
- [ ] Slider maximum is 1.0
- [ ] Text remains readable at 0.5 opacity
- [ ] Changes apply in real-time (preview)

**Notes:** _______________________________

---

## Test 9: Settings Dialog Capture Exclusion

**Objective:** Verify Settings dialog is hidden from screen capture (Zoom, Teams, OBS).

### Test 9a: Settings Dialog in Zoom

**Steps:**
1. Launch ScreenPrompt
2. Open Zoom and start a meeting (can be solo)
3. Click "Share Screen" and select your desktop
4. While sharing, open ScreenPrompt Settings dialog
5. Observe both your screen and Zoom's shared preview

**Expected Result:**
- [ ] Settings dialog visible on your actual screen
- [ ] Settings dialog NOT visible in Zoom's shared view
- [ ] No black rectangle where Settings dialog was
- [ ] Dialog remains functional while sharing

**Notes:** _______________________________

### Test 9b: Settings Dialog in Teams

**Steps:**
1. Launch ScreenPrompt
2. Open Teams and start a call/meeting
3. Click "Share" and select screen
4. While sharing, open ScreenPrompt Settings dialog
5. Check shared view or ask participant to confirm

**Expected Result:**
- [ ] Settings dialog visible locally
- [ ] Settings dialog NOT visible to participants
- [ ] No visual artifacts in shared content

**Notes:** _______________________________

### Test 9c: Settings Dialog in OBS

**Steps:**
1. Launch ScreenPrompt
2. Open OBS Studio with Display Capture source
3. Open ScreenPrompt Settings dialog
4. Check OBS preview window

**Expected Result:**
- [ ] Settings dialog visible on display
- [ ] Settings dialog NOT visible in OBS preview
- [ ] Recording does not capture Settings dialog

**Notes:** _______________________________

### Test 9d: Settings Dialog with Snipping Tool

**Steps:**
1. Launch ScreenPrompt and open Settings dialog
2. Position Settings dialog clearly visible
3. Press Win+Shift+S to capture area including dialog
4. Paste screenshot into Paint

**Expected Result:**
- [ ] Settings dialog visible during selection
- [ ] Settings dialog NOT in captured screenshot
- [ ] No artifacts where dialog was

**Notes:** _______________________________

---

## Test Summary

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| 1. Zoom | [ ] | [ ] | |
| 2. Teams | [ ] | [ ] | |
| 3. OBS | [ ] | [ ] | |
| 4. Snipping Tool | [ ] | [ ] | |
| 5. Multi-Monitor | [ ] | [ ] | |
| 6. Ethical Popup | [ ] | [ ] | |
| 7. Settings Persistence | [ ] | [ ] | |
| 8. Opacity Range | [ ] | [ ] | |
| 9a. Settings Dialog - Zoom | [ ] | [ ] | |
| 9b. Settings Dialog - Teams | [ ] | [ ] | |
| 9c. Settings Dialog - OBS | [ ] | [ ] | |
| 9d. Settings Dialog - Snipping | [ ] | [ ] | |

**Tested By:** _______________________________

**Date:** _______________________________

**Windows Version:** _______________________________

**Build Number:** _______________________________ (run `winver` to check)

---

## Troubleshooting

### Capture exclusion not working

1. Check Windows version: must be Build 19041+ (Win10 2004 or later)
   - Run `winver` to verify
2. Check for error messages in console/logs
3. Verify `SetWindowDisplayAffinity` is being called with `0x11`

### Overlay visible in capture

- Some older capture methods may not respect `WDA_EXCLUDEFROMCAPTURE`
- Window Capture (vs Display Capture) may behave differently
- Hardware-accelerated capture may have different behavior

### Settings not saving

1. Check `%APPDATA%\ScreenPrompt\` directory exists
2. Verify write permissions
3. Check for JSON syntax errors in config.json
