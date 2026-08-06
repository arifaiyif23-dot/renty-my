import { Loader2 } from "lucide-react";

export const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo-light.png" alt="Renty" className="h-8 w-auto dark:hidden animate-pulse" />
        <img src="/logo-dark.png" alt="Renty" className="h-8 w-auto hidden dark:block animate-pulse" />
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
};
