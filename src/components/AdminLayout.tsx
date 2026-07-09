import { AdminSidebar } from "@/components/AdminSidebar";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AdminLayout({ children, className }: AdminLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className={cn("flex-1 p-4 md:p-6 pb-mobile-nav", className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
