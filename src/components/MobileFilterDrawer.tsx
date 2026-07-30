import { type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileFilterDrawerProps {
  children: ReactNode;
  activeFiltersCount?: number;
  trigger?: ReactNode;
}

const MobileFilterDrawer = ({ children, activeFiltersCount = 0 }: MobileFilterDrawerProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 rounded-lg relative">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFiltersCount > 0 && (
              <span className="ml-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Filters</DrawerTitle>
          </DrawerHeader>
          <div className={cn("px-4 pb-6 overflow-y-auto max-h-[70vh]")}>
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-lg relative">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {activeFiltersCount > 0 && (
            <span className="ml-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        {children}
      </PopoverContent>
    </Popover>
  );
};

export { MobileFilterDrawer };
