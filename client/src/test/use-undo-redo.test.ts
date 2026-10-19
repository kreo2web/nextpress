import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useUndoRedo } from '@/hooks/useUndoRedo';

describe('useUndoRedo', () => {
  it('folds a replace into the step pushed in the same batch, so one undo goes back to the start', () => {
    const { result } = renderHook(() => useUndoRedo<string>('start'));

    act(() => {
      result.current.pushState('first change');
      result.current.replaceCurrentState('second change');
    });
    expect(result.current.currentState).toBe('second change');

    act(() => {
      result.current.undo();
    });
    expect(result.current.currentState).toBe('start');
    expect(result.current.canUndo).toBe(false);
  });

  it('still replaces the latest entry when the replace comes a render later', () => {
    const { result } = renderHook(() => useUndoRedo<string>('start'));

    act(() => result.current.pushState('typed a'));
    act(() => result.current.replaceCurrentState('typed ab'));
    act(() => {
      result.current.undo();
    });
    expect(result.current.currentState).toBe('start');
  });
});
