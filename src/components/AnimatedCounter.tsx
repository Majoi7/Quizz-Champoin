import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export function AnimatedCounter({ value, className = '' }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const currentRef = useRef(value);

  useEffect(() => {
    const startVal = currentRef.current;
    const endVal = value;
    if (startVal === endVal) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      currentRef.current = endVal;
      setDisplayValue(endVal);
      return;
    }

    const duration = 420;
    const startTime = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(startVal + (endVal - startVal) * eased);
      currentRef.current = next;
      setDisplayValue(next);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        currentRef.current = endVal;
        setDisplayValue(endVal);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <span className={`font-mono-tabular ${className}`}>{displayValue}</span>;
}
