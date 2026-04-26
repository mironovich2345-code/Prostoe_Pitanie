import { useEffect, useRef } from 'react';
import { api } from '../api/client';

/** Fire a behaviour event once when the component mounts. */
export function useTrackEvent(eventName: string): void {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    api.trackEvent(eventName);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
