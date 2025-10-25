import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background pb-mobile-nav">
      <div className="text-center px-4">
        <h1 className="mb-4 text-6xl font-bold text-foreground">{t('notFound.title')}</h1>
        <p className="mb-8 text-xl text-muted-foreground">{t('notFound.message')}</p>
        <Link to="/">
          <Button size="lg">
            <Home className="mr-2 h-4 w-4" />
            {t('notFound.button')}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
