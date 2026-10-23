// @vitest-environment jsdom
// MIT License - Copyright (c) 2026 ScreenPrompt Contributors

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UndoBar from './UndoBar';

afterEach(cleanup);

describe('UndoBar', () => {
  it('says what happened', () => {
    render(<UndoBar action="cleared" onUndo={() => {}} aboveFormatBar={false} />);
    expect(screen.getByRole('status').textContent).toContain('Notes cleared');
    cleanup();
    render(<UndoBar action="replaced" onUndo={() => {}} aboveFormatBar={false} />);
    expect(screen.getByRole('status').textContent).toContain('Notes replaced from clipboard');
  });

  it('undoes on click and mentions Ctrl+Z', () => {
    const onUndo = vi.fn();
    render(<UndoBar action="cleared" onUndo={onUndo} aboveFormatBar={false} />);
    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button.title).toContain('Ctrl+Z');
    fireEvent.click(button);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('moves up when the formatting toolbar is open', () => {
    render(<UndoBar action="cleared" onUndo={() => {}} aboveFormatBar />);
    expect(screen.getByRole('status').className).toContain('above-format-bar');
  });
});
