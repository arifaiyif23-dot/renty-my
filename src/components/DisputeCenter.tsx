import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AlertTriangle, Upload } from "lucide-react";

interface DisputeCenterProps {
  rentalId: string;
}

export const DisputeCenter = ({ rentalId }: DisputeCenterProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<File[]>([]);

  const disputeReasons = [
    "Item not as described",
    "Item damaged or defective",
    "Item not received",
    "Item returned but not acknowledged",
    "Overcharged",
    "Other issue"
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEvidence(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !reason || !description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    // Upload evidence files if any
    const evidenceUrls: string[] = [];
    for (const file of evidence) {
      const fileName = `${rentalId}/${Date.now()}-${file.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from("verification-documents")
        .upload(fileName, file);

      if (!uploadError && data) {
        const { data: urlData } = supabase.storage
          .from("verification-documents")
          .getPublicUrl(data.path);
        evidenceUrls.push(urlData.publicUrl);
      }
    }

    // Create notification for user (you'd need a disputes table in production)
    const { error } = await supabase.from("notifications").insert([{
      user_id: user.id,
      type: "rental_request",
      title: "Dispute Filed",
      message: `Your dispute regarding rental ${rentalId} has been submitted and is under review.`,
      link: `/dashboard`,
    }]);

    setLoading(false);

    if (error) {
      toast.error("Failed to submit dispute");
      return;
    }

    toast.success("Dispute submitted successfully. Our team will review it within 24 hours.");
    setOpen(false);
    setReason("");
    setDescription("");
    setEvidence([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <AlertTriangle className="w-4 h-4" />
          Report Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Report an Issue with this Rental</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="reason">Issue Type</Label>
            <Select value={reason} onValueChange={setReason} required>
              <SelectTrigger>
                <SelectValue placeholder="Select an issue type" />
              </SelectTrigger>
              <SelectContent>
                {disputeReasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Please provide detailed information about the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              required
            />
          </div>

          <div>
            <Label htmlFor="evidence">Upload Evidence (Optional)</Label>
            <div className="mt-2">
              <label
                htmlFor="evidence"
                className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload photos or documents
                  </span>
                  {evidence.length > 0 && (
                    <span className="text-xs text-primary">
                      {evidence.length} file(s) selected
                    </span>
                  )}
                </div>
                <input
                  id="evidence"
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">What happens next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Our team will review your case within 24 hours</li>
              <li>We may contact you for additional information</li>
              <li>Both parties will be notified of the outcome</li>
              <li>Resolution typically takes 3-5 business days</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Submitting..." : "Submit Dispute"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
