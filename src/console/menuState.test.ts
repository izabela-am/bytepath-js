import { describe, it, expect } from 'vitest';
import { MenuState, MENU_ENTRIES } from './menuState';

describe('MenuState', () => {
  it('starts on the first entry (new-run)', () => {
    const m = new MenuState();
    expect(m.selectedIndex).toBe(0);
    expect(m.selected).toBe('new-run');
  });

  describe('navigation', () => {
    it('moves down through the entries', () => {
      const m = new MenuState();
      m.moveDown();
      expect(m.selected).toBe('skill-tree');
      m.moveDown();
      expect(m.selected).toBe('respec');
    });

    it('wraps from the last entry back to the first', () => {
      const m = new MenuState();
      for (let i = 0; i < MENU_ENTRIES.length - 1; i++) m.moveDown();
      expect(m.selected).toBe(MENU_ENTRIES[MENU_ENTRIES.length - 1]);
      m.moveDown();
      expect(m.selected).toBe('new-run');
    });

    it('wraps from the first entry up to the last', () => {
      const m = new MenuState();
      m.moveUp();
      expect(m.selected).toBe(MENU_ENTRIES[MENU_ENTRIES.length - 1]);
    });
  });

  describe('single-Enter actions', () => {
    it('new run starts a Run', () => {
      const m = new MenuState();
      expect(m.confirm()).toBe('start-run');
    });

    it('skill tree opens the tree', () => {
      const m = new MenuState();
      m.moveDown();
      expect(m.confirm()).toBe('open-tree');
    });

    it('scanlines and sound toggle', () => {
      const m = new MenuState();
      m.moveDown();
      m.moveDown();
      m.moveDown();
      expect(m.selected).toBe('scanlines');
      expect(m.confirm()).toBe('toggle-scanlines');
      m.moveDown();
      expect(m.confirm()).toBe('toggle-sound');
    });
  });

  describe('respec confirm', () => {
    function selectRespec(): MenuState {
      const m = new MenuState();
      m.moveDown();
      m.moveDown();
      expect(m.selected).toBe('respec');
      return m;
    }

    it('first Enter arms (no action), second Enter fires respec', () => {
      const m = selectRespec();
      expect(m.isRespecArmed).toBe(false);
      expect(m.confirm()).toBe('none');
      expect(m.isRespecArmed).toBe(true);
      expect(m.confirm()).toBe('respec');
      expect(m.isRespecArmed).toBe(false);
    });

    it('moving the cursor cancels a pending confirm', () => {
      const m = selectRespec();
      m.confirm(); // arm
      expect(m.isRespecArmed).toBe(true);
      m.moveDown();
      expect(m.isRespecArmed).toBe(false);
      // Coming back and confirming arms again rather than firing.
      m.moveUp();
      expect(m.selected).toBe('respec');
      expect(m.confirm()).toBe('none');
    });

    it('reset() disarms without moving the cursor', () => {
      const m = selectRespec();
      m.confirm(); // arm
      m.reset();
      expect(m.isRespecArmed).toBe(false);
      expect(m.selected).toBe('respec');
    });
  });
});
