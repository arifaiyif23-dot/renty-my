import { type ElementType } from "react";
import { AuroraBackground } from "@/components/AuroraBackground";
import { EmptyStateV2 } from "@/components/EmptyStateV2";

interface AuroraEmptyStateProps {
  icon?: ElementType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const AuroraEmptyState = ({ icon, title, description, actionLabel, onAction }: AuroraEmptyStateProps) => {
  return (
    <AuroraBackground variant="empty" className="rounded-2xl">
      <div className="flex items-center justify-center h-full py-12">
        <EmptyStateV2
          icon={icon}
          title={title}
          description={description}
          actionLabel={actionLabel}
          onAction={onAction}
        />
      </div>
    </AuroraBackground>
  );
};

export { AuroraEmptyState };
