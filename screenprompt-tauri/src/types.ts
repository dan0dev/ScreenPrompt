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
  fontFamily: 'Consolas, "Courier New", monospace',
  fontSize: 14,
  fontColor: '#FFFFFF',
  bgColor: '#2d2d2d',
  text: '',
  firstRunShown: false,
  locked: false,
  autoCheckUpdates: true,
  keyboardLayout: 'auto',
};

export const OPACITY_LEVELS = [1.0, 0.85, 0.70, 0.50];

export const TEXT_COLORS = [
  '#FFFFFF', // white
  '#E0E0E0', // light gray
  '#FFFF00', // yellow
  '#00FF00', // green
  '#00FFFF', // cyan
  '#87CEEB', // sky blue
  '#FFA500', // orange
  '#FF69B4', // pink
];

export const BG_COLORS = [
  '#1E1E1E', // near black
  '#2D2D2D', // dark gray
  '#1A1A2E', // dark blue
  '#1E3A2E', // dark green
  '#2E1A1A', // dark red
  '#2E1A2E', // dark purple
  '#2D2D1A', // dark olive
  '#1A2D2D', // dark teal
];

export const FONT_FAMILIES = [
  'Consolas, "Courier New", monospace',
  '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  'Arial, Helvetica, sans-serif',
  '"Courier New", Courier, monospace',
  'Calibri, sans-serif',
  'Verdana, Geneva, Tahoma, sans-serif',
  '"Times New Roman", Times, serif',
  'Georgia, serif',
];
