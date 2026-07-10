import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useSuspensionCheck() {
  const { profile } = useAuth();

  const checkNotSuspended = (action?: string): boolean => {
    if (profile?.is_suspended) {
      toast.error(
        action
          ? `Cannot ${action}: Your account has been suspended. Contact support for assistance.`
          : "Your account has been suspended. Contact support for assistance."
      );
      return false;
    }
    return true;
  };

  return { isSuspended: profile?.is_suspended ?? false, suspensionReason: profile?.suspension_reason, checkNotSuspended };
}
