import { type ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: ReactNode;
  variant?: "full" | "default" | "narrow" | "blank";
  showFooter?: boolean;
  className?: string;
}

const widthClasses: Record<string, string> = {
  full: "",
  default: "mx-auto px-4 max-w-5xl",
  narrow: "mx-auto px-4 max-w-3xl",
  blank: "",
};

const paddingClasses: Record<string, string> = {
  full: "py-0",
  default: "py-6",
  narrow: "py-6",
  blank: "py-0",
};

const PageLayout = ({ children, variant = "default", showFooter = true, className }: PageLayoutProps) => {
  return (
    <div className="flex flex-col min-h-screen w-full">
      <Header />
      <main
        id="main-content"
        className={cn(
          "flex-1 pb-mobile-nav",
          widthClasses[variant],
          paddingClasses[variant],
          className
        )}
      >
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
};

export { PageLayout };
