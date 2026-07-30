import { type ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: ReactNode;
  variant?: "full" | "default" | "wide" | "narrow" | "blank";
  showFooter?: boolean;
  className?: string;
}

const widthClasses: Record<string, string> = {
  full: "",
  // Desktop marketplace shell: matches Header's max-w-7xl with roomier gutters
  default: "mx-auto px-4 md:px-6 lg:px-8 max-w-7xl",
  wide: "mx-auto px-4 md:px-6 lg:px-8 max-w-7xl",
  narrow: "mx-auto px-4 max-w-3xl",
  blank: "",
};

const paddingClasses: Record<string, string> = {
  full: "py-0",
  default: "py-6 md:py-8",
  wide: "py-6 md:py-8",
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
      {/* Mobile uses the bottom tab bar as primary chrome; footer is desktop navigation */}
      {showFooter && (
        <div className="hidden md:block">
          <Footer />
        </div>
      )}
    </div>
  );
};

export { PageLayout };
