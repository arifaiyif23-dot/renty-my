import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";

const REPORT_REASONS = [
  { value: "inappropriate", label: "Inappropriate Content" },
  { value: "spam", label: "Spam" },
  { value: "fraud", label: "Fraud or Scam" },
  { value: "fake", label: "Fake Listing" },
  { value: "harassment", label: "Harassment" },
  { value: "prohibited", label: "Prohibited Item" },
  { value: "other", label: "Other" },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "item" | "user" | "message";
  targetId: string;
  onReported?: () => void;
}

export function ReportDialog({ open, onOpenChange, targetType, targetId, onReported }: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to report");
      return;
    }
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason,
        description: description || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Report submitted. Our team will review it.");
      onReported?.();
      onOpenChange(false);
      setReason("");
      setDescription("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Report {targetType === "item" ? "Listing" : targetType === "user" ? "User" : "Message"}
          </DialogTitle>
          <DialogDescription>
            Help keep our community safe. Your report will be reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Details (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={loading || !reason}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
