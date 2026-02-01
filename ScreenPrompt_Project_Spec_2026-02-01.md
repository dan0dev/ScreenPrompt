Project Description: ScreenPrompt – Hidden Teleprompter Application
Executive Summary

Project Name: ScreenPrompt
Platform: Windows 10/11 (Build 2004+)
Core Technologies: Python 3.10+, Tkinter/PyQt5, WinAPI (ctypes), WiX Toolset v3.11+
Final Output: .msi installer package
Estimated Development Time: 3–4 weeks

ScreenPrompt is a desktop application that displays a transparent, always-on-top overlay window with custom text (notes, teleprompter).
Its unique feature is that only the user can see the overlay — it remains hidden from all screen sharing (Zoom, Microsoft Teams, Google Meet), screen recording, and screenshot tools by leveraging the Windows SetWindowDisplayAffinity API.
mssqltips

1. Business Need and Use Cases
   1.1 Problem

During presentations, online meetings, and educational video recordings, presenters often need on-screen notes, but:

Traditional teleprompter apps are visible during screen sharing
youtube

A second monitor is not always available

Paper notes distract attention away from the camera

1.2 Target Audience

Presenters and speakers (meetings, webinars)

Online educators and content creators

Sales / technical support professionals (product demos)
speakflow

Interview and recording session participants

1.3 Core Features

Capture exclusion: Using WinAPI WDA_EXCLUDEFROMCAPTURE flag
meziantou

Transparent overlay: Configurable alpha value (0.5–1.0)

Always-on-top: Floats above all applications

Click-through mode: Optionally allows mouse clicks to pass through
stackoverflow

Position and size persistence: User preferences stored in JSON

Hotkey support: Quick show/hide/edit (e.g. Ctrl+Shift+P)

Font and color customization: Optimized readability

Multi-monitor support: Can be positioned on any display

2. Technical Specification
   2.1 Architecture
   ┌─────────────────────────────────────────┐
   │ GUI Layer (Tkinter/PyQt5) │
   │ - Main Window (overlay) │
   │ - Settings Dialog │
   │ - System Tray Integration │
   └──────────────┬──────────────────────────┘
   │
   ┌──────────────▼──────────────────────────┐
   │ Application Logic │
   │ - Text Management │
   │ - Window Positioning │
   │ - Hotkey Handler (pynput/keyboard) │
   │ - Config Manager (JSON) │
   └──────────────┬──────────────────────────┘
   │
   ┌──────────────▼──────────────────────────┐
   │ WinAPI Integration (ctypes) │
   │ - SetWindowDisplayAffinity() │
   │ - SetWindowLong() (click-through) │
   │ - SetLayeredWindowAttributes() │
   └─────────────────────────────────────────┘

2.2 Main Components
2.2.1 Core Module (prompter_core.py)
class PromptWindow:
"""Transparent overlay window with WinAPI integration"""
def **init**(self): # Tkinter/PyQt window setup # Apply WDA_EXCLUDEFROMCAPTURE # Configure transparency and always-on-top

    def set_capture_exclude(self, hwnd: int):
        """SetWindowDisplayAffinity WinAPI call"""
        user32 = ctypes.WinDLL('user32')
        WDA_EXCLUDEFROMCAPTURE = 0x11
        user32.SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)

    def toggle_click_through(self):
        """Enable/disable click-through mode"""

2.2.2 Configuration Module (config_manager.py)
class ConfigManager:
"""Persistent storage for user settings""" - load_config() -> dict - save_config(config: dict) - get_default_config() -> dict

    # Settings: position, size, opacity, font, colors, hotkeys

2.2.3 UI Module (settings_ui.py)

Settings dialog (font picker, color picker, opacity slider)

System tray integration (show / hide / exit)

Text editor window (store and switch between multiple prompts)

2.3 Technology Stack
Component Technology Rationale
UI Framework Tkinter Built-in, lightweight, WinAPI compatible
WinAPI Binding ctypes Native Python, supports SetWindowDisplayAffinity
Hotkey Management pynput or keyboard Cross-thread hotkey detection
Config Storage JSON (stdlib) Simple, human-readable
Packaging PyInstaller One-folder bundle (~50 MB)
Installer WiX Toolset v3.11 Professional MSI with wizard UI
2.4 System Requirements

Minimum:

Windows 10 Build 2004 (May 2020) or later

50 MB free disk space

100 MB RAM

Recommended:

Windows 11

1920×1080+ resolution (multi-monitor setup)

3. Implementation Plan
   3.1 Development Phases
   Phase 1: MVP (1 week)

Always-on-top transparent Tkinter window

SetWindowDisplayAffinity integration

Basic text display

Manual tests with Zoom / Teams

JSON config read/write

Phase 2: Feature Complete (1.5 weeks)

Settings UI (font, color, opacity, position)

Hotkey support (show/hide, quick edit)

Click-through mode

System tray icon

Multi-prompt management

Error handling and logging

Phase 3: Packaging (0.5 week)

PyInstaller configuration (one-folder)

Icon and branding assets

README and LICENSE files

Unit tests for critical components

Phase 4: MSI Installer (1 week)

WiX Toolset project setup

heat.exe file harvesting from PyInstaller output

Wizard UI (WixUI_InstallDir)

Desktop and Start Menu shortcuts

Uninstaller integration

MSI testing on clean Windows systems

3.2 File Structure
screenprompt/
├── src/
│ ├── **init**.py
│ ├── main.py
│ ├── prompter_core.py
│ ├── config_manager.py
│ ├── settings_ui.py
│ └── utils.py
├── resources/
│ ├── icon.ico
│ ├── logo.png
│ └── default_config.json
├── tests/
│ ├── test_core.py
│ └── test_config.py
├── installer/
│ ├── Product.wxs
│ ├── License.rtf
│ └── build_msi.ps1
├── docs/
│ ├── USER_GUIDE.md
│ └── DEVELOPER_NOTES.md
├── requirements.txt
├── build_spec.py
└── README.md

4. MSI Installer Details
   4.1 Build Pipeline
   pyinstaller --onedir --windowed --icon=resources/icon.ico src/main.py
   heat.exe dir "dist/main/" -cg AppFiles -dr INSTALLFOLDER -var var.SourceDir -ag -sfrag -out installer/Files.wxs
   candle.exe installer/Product.wxs installer/Files.wxs
   light.exe -ext WixUIExtension Product.wixobj Files.wixobj -out ScreenPrompt-1.0.0.msi

4.2 WiX Features

Wizard-based installer (WixUI_InstallDir)

License agreement (MIT or other)

Custom install directory

Desktop and Start Menu shortcuts

Add/Remove Programs registration

4.3 Versioning Strategy

Semantic Versioning: MAJOR.MINOR.PATCH

Fixed MSI UpgradeCode

New ProductCode for every release

5. Testing and QA
   5.1 Manual Tests

Screen share exclusion (Zoom, Teams, Meet)

Screenshot tools (Snipping Tool, Win+Shift+S)

OBS display capture

Click-through mode

Always-on-top behavior

Multi-monitor support

Hotkey functionality

5.2 Automated Tests

Unit tests (config management, mocked WinAPI)

Integration tests (window creation, state persistence)

Build tests (PyInstaller and MSI creation)

5.3 Compatibility Matrix
OS Build Support
Windows 10 <2004 ❌ Not supported
Windows 10 2004+ ✅ Fully supported
Windows 11 ✅ Fully supported 6. Risks and Limitations
Known Limitations

Browser-based capture may ignore the API flag

Unsupported Windows versions may show black boxes

Windows-only implementation

Development Risks

WinAPI compatibility

PyInstaller bundle size

WiX learning curve

Hotkey conflicts

7. Deliverables

Git repository

Documented source code

MSI installer and portable ZIP

SHA256 checksums

Optional CI/CD pipeline

8. Future Roadmap

v1.1

Cloud sync

Markdown support

Auto-scroll teleprompter mode

v1.2

macOS port (Electron workaround)

Browser extension

v2.0

AI-powered script generation

Team collaboration

9. Cost Estimate

Total Development: ~160 hours (4 weeks, one senior developer)

10. Success Criteria

95%+ screen-share invisibility

Installer works without admin rights

Crash rate <1%

User-friendly setup

Complete, reviewed documentation

11. References

WiX Toolset documentation

Microsoft SetWindowDisplayAffinity API

PyInstaller documentation

Python project structuring best practices

Project Status: Planning
Last Updated: 2026-02-01
Prepared by: [Name]
Reviewed by: [Senior Developer Name]

ScreenPrompt – Hidden Teleprompter.

Legal Considerations for ScreenPrompt (Open Source)

Yes, there are several important legal aspects to consider, especially since this will be an open-source project. Below is a structured overview of the critical legal areas you should address.

1. License Selection
   Recommended License: MIT License

For this project, the MIT License is the most appropriate choice because it is:

Simple and concise – short, easy to understand

Permissive – allows commercial use, modification, and redistribution

Dependency-compatible – compatible with Tkinter (BSD-style) and PyInstaller (GPL with exception)

Widely accepted – common in Python and general open-source ecosystems

Liability-protective – includes strong “AS IS” and warranty disclaimer clauses

Alternative:
Apache 2.0 if you want explicit patent protection, though this is usually unnecessary for a small utility tool.

Do NOT choose GPL:
GPL is a copyleft license requiring derivative works to also be GPL, which significantly restricts commercial and proprietary usage.

2. Mandatory Legal Disclaimers
   2.1 Warranty Disclaimer

The MIT License already includes this, but it should also be explicitly referenced in:

README.md

Application “About” dialog

Installer license screen

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR
ANY CLAIM, DAMAGES OR OTHER LIABILITY.

This protects you from liability if the software fails, malfunctions, or causes damage.

2.2 Limitation of Liability

Explicitly state that:

You are not responsible for data loss

You are not liable for third-party damages

The software is used at the user’s own risk

3. Ethical and Legal Use Concerns
   3.1 Exam Cheating / Proctoring Systems (Critical Risk)

Major concern:
The application can be misused to cheat during online exams or bypass proctoring systems by hiding on-screen text.

Required actions:

README Disclaimer

## Intended Use and Ethical Notice

ScreenPrompt is designed for legitimate purposes such as:

- Presentations and webinars
- Content creation and streaming
- Personal note-taking during meetings

This tool MUST NOT be used to:

- Cheat on proctored exams or assessments
- Violate academic integrity policies
- Circumvent monitoring systems in unauthorized ways

Users are solely responsible for ensuring their use complies
with applicable laws, institutional policies, and ethical standards.

In-App Warning

Display an ethical use notice on first launch

Documentation

Provide clear examples of legitimate use cases

Why this matters:
Online proctoring vendors and educational institutions have a history of legal disputes. You must clearly distance yourself from misuse.

3.2 Meeting Platform Terms of Service (Zoom / Teams / Meet)

These platforms place legal responsibility on the user, not the tool developer.

There is no explicit prohibition against overlay tools, but internal company or academic policies may apply.

Recommended documentation section:

## Meeting Platform Compatibility

This tool works with screen sharing on Zoom, Microsoft Teams,
and Google Meet by leveraging Windows APIs. However:

- Users MUST comply with their organization's IT policies
- Educational institutions may prohibit such tools during exams
- Some meeting hosts may restrict hidden overlays
- Always obtain permission when required

4. Third-Party Dependencies and Licenses
   4.1 License Compatibility
   Dependency License MIT Compatible Notes
   Python PSF License ✅ Permissive
   Tkinter BSD-style ✅ Commercial use allowed
   PyInstaller GPL 2.0 + Exception ✅ Bootloader exception applies
   WiX Toolset MS-RL ✅ Build-time only
   ctypes Python stdlib ✅ Built-in
   pynput / keyboard GPL / MIT ⚠️ Avoid GPL or replace if necessary

Important:
PyInstaller’s GPL does not infect your app due to the explicit exception.

WiX is a build tool and does not affect the final binary license.

4.2 Third-Party License Files

Recommended repository structure:

LICENSES/
├── MIT.txt
├── Python-PSF.txt
├── Tkinter-BSD.txt
└── PyInstaller-Notice.txt

Your MSI installer should reference or include these notices.

5. Privacy & GDPR
   5.1 No Data Collection (Recommended)

If ScreenPrompt:

Runs fully locally

Sends no telemetry

Connects to no servers

Then GDPR does not directly apply.

Still recommended:

## Privacy Policy

ScreenPrompt runs entirely on your local machine.
We do NOT:

- Collect personal data
- Track usage or analytics
- Connect to external servers
- Store data in the cloud

All configuration data remains on your device.

5.2 Future Telemetry (If Added Later)

If you later add crash reports or analytics:

Explicit user consent is required

Data minimization applies

Right to deletion must be implemented

Privacy Policy must be updated

Recommendation: No telemetry in MVP; opt-in only later.

6. Trademark and Naming
   6.1 Name Availability

Check “ScreenPrompt” in:

USPTO (US)

EUIPO (EU)

GitHub / Google

If conflicts exist, rename (e.g. OverlayPrompt, StealthNote).

6.2 Platform Name Usage

❌ Do NOT use names like:

“Zoom Prompter”

“Teams Teleprompter”

✅ Allowed:

“Works with Zoom, Microsoft Teams, Google Meet” (fair use)

7. Required README Sections

## License

MIT License – see LICENSE.txt

## Intended Use

[Ethical disclaimer]

## Legal Notice

This software is provided "AS IS".
Users are responsible for compliance with applicable laws,
organizational policies, and platform terms of service.

## Third-Party Licenses

See LICENSES/ folder.

## Contributing

By contributing, you agree to license your work under the MIT License.

8. MSI Installer Legal Requirements
   8.1 Code Signing (Recommended)

Unsigned MSI files trigger Windows SmartScreen warnings.

Options:

Purchase a code-signing certificate ($50–200/year)

Or clearly explain the warning in the README

8.2 Installer License Dialog

Include MIT License as license.rtf

Mandatory “I accept the terms” checkbox

9. Export Control

No export restrictions apply.
SetWindowDisplayAffinity does not involve encryption.

10. Summary – Action Items
    Mandatory

MIT License in repository root

Warranty disclaimer in README and app

Ethical use disclaimer (exam/proctoring context)

Third-party license documentation

Basic privacy statement

Recommended

CONTRIBUTING.md

CODE_OF_CONDUCT.md

First-run ethical use notice

TOS compatibility notes

Installer license dialog

Optional (Later)

Code signing certificate

Trademark registration

LEGAL.md FAQ

Conclusion

ScreenPrompt is legal and viable as an open-source project, but clear disclaimers and ethical usage boundaries are essential, especially due to potential misuse in exam or monitoring scenarios.

Using the MIT License, proper documentation, and explicit responsibility disclaimers provides strong protection against liability while keeping the project open, permissive, and professional.
