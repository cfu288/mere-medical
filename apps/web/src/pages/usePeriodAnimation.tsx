import { useEffect, useState } from 'react';

export function usePeriodAnimation() {
  const [showPeriodText, setShowPeriodText] = useState('...');

  useEffect(() => {
    const interval = setInterval(() => {
      if (showPeriodText === '...') {
        setShowPeriodText('.');
      } else if (showPeriodText === '.') {
        setShowPeriodText('..');
      } else if (showPeriodText === '..') {
        setShowPeriodText('...');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [showPeriodText]);

  return showPeriodText;
}
