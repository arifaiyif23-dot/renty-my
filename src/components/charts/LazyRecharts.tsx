import { useState, useEffect, type ReactNode } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type RechartsModule = typeof import('recharts');

let cache: RechartsModule | null = null;
let promise: Promise<RechartsModule> | null = null;

function loadRecharts(): Promise<RechartsModule> {
  if (cache) return Promise.resolve(cache);
  if (!promise) {
    promise = import('recharts').then((mod) => {
      cache = mod;
      return mod;
    });
  }
  return promise;
}

interface Props {
  children: (recharts: RechartsModule) => ReactNode;
  fallback?: ReactNode;
}

export function LazyRecharts({ children, fallback }: Props) {
  const [recharts, setRecharts] = useState<RechartsModule | null>(cache);

  useEffect(() => {
    if (!recharts) {
      loadRecharts().then(setRecharts);
    }
  }, [recharts]);

  if (!recharts) {
    return fallback ? <>{fallback}</> : <div className="flex justify-center py-10"><LoadingSpinner /></div>;
  }

  return <>{children(recharts)}</>;
}
