import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface QuickQuestionProps {
  ownerId: string;
  ownerName: string;
}

export default function QuickQuestion({ ownerId, ownerName }: QuickQuestionProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Please sign in to ask a question");
      return;
    }
    const text = question.trim();
    if (!text) return;

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        recipient_id: ownerId,
        content: text,
        delivered_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Question sent! The owner will respond shortly.");
      setQuestion("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send question");
    } finally {
      setSending(false);
    }
  };

  if (user?.id === ownerId) return null;

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-4 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Ask {ownerName} a question
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Have a question about this item? Send a message directly to the owner.
          </p>
          <Textarea
            placeholder={`e.g. Is this available on ${new Date().toLocaleDateString('en-MY', { weekday: 'long' })}?`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!question.trim() || sending}
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Send Question
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
