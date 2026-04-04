
import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export const useSessionTimeout = (onTimeout: () => void, enabled = true) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (enabled) {
      timeoutRef.current = setTimeout(() => {
        onTimeout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [onTimeout, enabled]);

  useEffect(() => {
    if (!enabled) return;

    resetTimer();

    const handleActivity = () => resetTimer();

    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer, enabled]);

  return { resetTimer };
};
