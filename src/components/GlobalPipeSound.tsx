import { useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';

export function GlobalPipeSound() {
  const { pipeVolume, pipeFrequency } = useSettings();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleClang = () => {
      const delay = (Math.random() * (10 - 3) + 3) * 60 * pipeFrequency;
      timeoutRef.current = setTimeout(() => {
        const audio = new Audio('/pipe.mp3');
        audio.volume = pipeVolume / 100;
        audio.play().catch(() => {
          // Ignore autoplay policy errors until the user interacts with the page.
        });
        scheduleClang();
      }, delay);
    };

    scheduleClang();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pipeVolume, pipeFrequency]);

  return null;
}
