import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useActiveStatus(userId?: string | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ping = async () => {
    if (!userId) return;
    try {
      await supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", userId);
    } catch {
      // Silent fail
    }
  };

  useEffect(() => {
    if (!userId) return;
    ping();
    intervalRef.current = setInterval(ping, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
