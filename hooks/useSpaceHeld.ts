import { useEffect, useState } from 'react';

import { isTyping } from '../lib/keyboard';

/**
 * Whether the space bar is down, for space+drag panning.
 *
 * Space pressed on a field or a focused button is that control's own key —
 * a space in the text, or the button's activation — and is left alone.
 */
export function useSpaceHeld(): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      if (isTyping(event.target) || event.target instanceof HTMLButtonElement) return;
      // Space would otherwise scroll the page.
      event.preventDefault();
      setHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setHeld(false);
    };
    // The keyup goes elsewhere if the window loses focus mid-hold.
    const release = () => setHeld(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', release);
    };
  }, []);

  return held;
}
