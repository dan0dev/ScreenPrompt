// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

export interface Config {
  // Window position and size
  x: number;
  y: number;
  width: number;
  height: number;

  // Appearance
  opacity: number;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  bgColor: string;

  // State
  text: string;
  firstRunShown: boolean;
  locked: boolean; // Mouse pass-through mode

  // Updates
  autoCheckUpdates: boolean;

  // Keyboard layout: 'auto' | 'hu' | 'en'
  keyboardLayout: string;
}

export const DEFAULT_CONFIG: Config = {
  x: 100,
  y: 100,
  width: 400,
  height: 200,
  opacity: 0.85,
  fontFamily: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  fontSize: 18,
  fontColor: '#FFFFFF',
  bgColor: '#1C1C1E',
  text: '',
  firstRunShown: false,
  locked: false,
  autoCheckUpdates: true,
  keyboardLayout: 'auto',
};

export const OPACITY_LEVELS = [1.0, 0.85, 0.70, 0.50];

// Text colors — Apple system-color hues (dark-mode variants) plus neutrals
export const TEXT_COLORS = [
  '#FFFFFF', // white
  '#C7C7CC', // light gray (secondary-label feel)
  '#FFD60A', // systemYellow
  '#30D158', // systemGreen
  '#64D2FF', // systemTeal
  '#0A84FF', // systemBlue
  '#FF9F0A', // systemOrange
  '#FF375F', // systemPink
];

// Background colors — refined dark grays plus subtly tinted darks
export const BG_COLORS = [
  '#1C1C1E', // near black (systemGray6 dark)
  '#2C2C2E', // dark gray
  '#000000', // pure black
  '#16222E', // dark blue
  '#14261C', // dark green
  '#2A1730', // dark purple
  '#2E1D14', // dark amber
  '#0F2529', // dark teal
];

export const FONT_FAMILIES = [
  '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Calibri, sans-serif',
  'Verdana, Geneva, Tahoma, sans-serif',
  'Consolas, "Courier New", monospace',
  '"Courier New", Courier, monospace',
  '"Times New Roman", Times, serif',
  'Georgia, serif',
];
