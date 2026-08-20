import { useEffect, useState } from 'react';
import { getSignedUrl, isPublicUrl } from '@/utils/signedUrls';

// Resolves an array of evidence values (public URLs or storage paths) to
// displayable URLs. Public URLs pass through; storage paths are resolved via
// signed URLs (short-lived). Empty / null input yields an empty array.
export function useSignedUrls(paths: string[] | null | undefined): string[] {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const list = paths ?? [];
    if (list.length === 0) {
      setUrls([]);
      return;
    }

    let cancelled = false;
    Promise.all(
      list.map((p) => (isPublicUrl(p) ? Promise.resolve(p) : getSignedUrl(p)))
    )
      .then((res) => {
        if (!cancelled) setUrls(res);
      })
      .catch((err) => {
        console.error('Error resolving signed URLs:', err);
        if (!cancelled) setUrls(list.map(() => ''));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(paths)]);

  return urls;
}