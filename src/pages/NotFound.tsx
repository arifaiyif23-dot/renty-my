import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Home, SearchX } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background pb-mobile-nav">
      <GlassCard className="max-w-md w-full text-center" padding="lg">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <SearchX className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-6xl font-bold text-foreground">{t('notFound.title')}</h1>
        <p className="mb-6 text-muted-foreground">{t('notFound.message')}</p>
        <Link to="/">
          <Button size="lg" className="rounded-lg">
            <Home className="mr-2 h-4 w-4" />
            {t('notFound.button')}
          </Button>
        </Link>
      </GlassCard>
    </div>
  );
};

export default NotFound;
