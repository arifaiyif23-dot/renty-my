import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/rentalTime";

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const PRESETS = [
  { key: "presetMorning", value: "09:00" },
  { key: "presetNoon", value: "12:00" },
  { key: "presetAfternoon", value: "15:00" },
  { key: "presetEvening", value: "18:00" },
];

export function TimePicker({ label, value, onChange, className }: TimePickerProps) {
  const { t } = useTranslation();
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={cn(
              "text-xs rounded-full px-3 py-1.5 border transition-colors",
              value === p.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {t(`rentalTime.${p.key}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        {value && (
          <span className="text-sm font-medium tabular-nums text-muted-foreground whitespace-nowrap">{formatTime(value)}</span>
        )}
      </div>
    </div>
  );
}
