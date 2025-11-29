import { useEffect, useRef, useState } from 'react';
import { DeviceSample } from '../types/DeviceSample';

export interface UseDeviceStreamOptions {
  windowMinutes: number;
  playbackIntervalMs?: number;
  jsonlPath?: string;
}

export interface UseDeviceStreamResult {
  samples: DeviceSample[];
  lastMessageTime: number | null;
  isLoading: boolean;
  error: string | null;
}

function appendAndTrim(
  prev: DeviceSample[],
  sample: DeviceSample,
  windowMinutes: number
): DeviceSample[] {
  const cutoff =
    new Date(sample.timestamp).getTime() - windowMinutes * 60_000;
  const next = [...prev, sample];
  return next.filter(
    (s) => new Date(s.timestamp).getTime() >= cutoff
  );
}

export function useDeviceStream(
  options: UseDeviceStreamOptions
): UseDeviceStreamResult {
  const { windowMinutes, playbackIntervalMs = 1000, jsonlPath = '/device.jsonl' } =
    options;

  const [samples, setSamples] = useState<DeviceSample[]>([]);
  const [lastMessageTime, setLastMessageTime] = useState<number | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const indexRef = useRef(0);
  const linesRef = useRef<string[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(jsonlPath)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ${jsonlPath}: ${res.statusText}`);
        }
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const lines = text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        linesRef.current = lines;
        indexRef.current = 0;

        const tick = () => {
          if (indexRef.current >= linesRef.current.length) {
            // stop at end of file
            if (intervalRef.current !== null) {
              window.clearInterval(intervalRef.current);
            }
            return;
          }
          const line = linesRef.current[indexRef.current++];
          try {
            const sample = JSON.parse(line) as DeviceSample;
            setSamples((prev) => appendAndTrim(prev, sample, windowMinutes));
            setLastMessageTime(Date.now());
          } catch (e) {
            console.error('Failed to parse JSONL line', e);
          }
        };

        tick(); // start with first sample immediately
        const id = window.setInterval(tick, playbackIntervalMs);
        intervalRef.current = id;
        setIsLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [jsonlPath, playbackIntervalMs, windowMinutes]);

  return { samples, lastMessageTime, isLoading, error };
}