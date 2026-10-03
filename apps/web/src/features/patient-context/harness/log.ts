import { useCallback, useRef, useState } from 'react';

import { createHarness, Harness, Logged } from './events';

export function useHarnessLog(): {
  log: Logged[];
  makeHarness: () => { harness: Harness; events: Logged[] };
} {
  const [log, setLog] = useState<Logged[]>([]);
  const seqRef = useRef(0);
  const runCounterRef = useRef(0);

  const makeHarness = useCallback(() => {
    runCounterRef.current += 1;
    const events: Logged[] = [];
    const harness = createHarness(`run-${runCounterRef.current}`, (event) => {
      const entry = {
        ...event,
        env: { seq: seqRef.current, at: new Date().toISOString() },
      };
      seqRef.current += 1;
      events.push(entry);
      setLog((current) => [...current, entry]);
    });
    return { harness, events };
  }, []);

  return { log, makeHarness };
}
