import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Maximize2, 
  X,
  Loader2,
  CheckCircle,
  User,
  FileText
} from "lucide-react";
import { getSignedUrl } from "@/utils/signedUrls";
import { invokeAdminOperation } from "@/lib/adminOperations";
import { toast } from "sonner";

interface DocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verification: {
    id: string;
    user_id: string;
    document_front_url: string;
    document_back_url: string | null;
    selfie_url: string;
    full_name_on_document: string;
    document_type: string;
    ai_analysis_result?: Record<string, unknown>;
    overall_confidence_score?: number | null;
  } | null;
  onApprove?: () => void;
  onReject?: () => void;
}

export function DocumentViewerModal({
  open,
  onOpenChange,
  verification,
  onApprove,
  onReject
}: DocumentViewerModalProps) {
  const [activeTab, setActiveTab] = useState("front");
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<{
    front: string | null;
    back: string | null;
    selfie: string | null;
  }>({ front: null, back: null, selfie: null });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const extractPath = useCallback((url: string) => {
    if (!url) return url;
    try {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(?:public\/)?(?:.+?\/(.+))$/);
      if (pathMatch) return pathMatch[1];
    } catch {
      // Fallback if URL is malformed
    }
    const parts = url.split('verification-documents/');
    if (parts.length > 1) return parts.slice(1).join('/');
    // If path doesn't include bucket prefix, add it
    if (!url.startsWith('verification-documents/')) {
      return `verification-documents/${url}`;
    }
    return url;
  }, []);

  useEffect(() => {
    if (open && verification) {
      const loadSignedUrls = async () => {
        if (!verification) return;
        
        setLoading(true);
        try {
          const frontPath = extractPath(verification.document_front_url);
          const frontUrl = await getSignedUrl(frontPath);

          let backUrl = null;
          if (verification.document_back_url) {
            const backPath = extractPath(verification.document_back_url);
            backUrl = await getSignedUrl(backPath);
          }

          const selfiePath = extractPath(verification.selfie_url);
          const selfieUrl = await getSignedUrl(selfiePath);

          setSignedUrls({ front: frontUrl, back: backUrl, selfie: selfieUrl });

          await invokeAdminOperation({
            action: 'log_sensitive_access',
            resourceType: 'verification_document',
            resourceId: verification.id,
          });
        } catch (error) {
          console.error("Failed to load signed URLs:", error);
          toast.error("Failed to load documents");
        } finally {
          setLoading(false);
        }
      };
      loadSignedUrls();
      // Reset view state
      setZoom(1);
      setRotation(0);
      setActiveTab("front");
    }
  }, [open, verification, extractPath]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotateCw = () => setRotation(prev => prev + 90);
  const handleRotateCcw = () => setRotation(prev => prev - 90);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };

  // Keyboard shortcuts for modal
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          setZoom(prev => Math.min(prev + 0.25, 3));
          break;
        case '-':
          e.preventDefault();
          setZoom(prev => Math.max(prev - 0.25, 0.5));
          break;
        case 'r':
          e.preventDefault();
          setRotation(prev => prev + 90);
          break;
        case 'R':
          e.preventDefault();
          setRotation(prev => prev - 90);
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          setRotation(0);
          break;
        case '1':
          e.preventDefault();
          setActiveTab("front");
          break;
        case '2':
          e.preventDefault();
          if (signedUrls.back) setActiveTab("back");
          break;
        case '3':
          e.preventDefault();
          setActiveTab("selfie");
          break;
        case 'Escape':
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, signedUrls.back, onOpenChange]);

  const getCurrentUrl = () => {
    switch (activeTab) {
      case "front": return signedUrls.front;
      case "back": return signedUrls.back;
      case "selfie": return signedUrls.selfie;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl">
                Document Verification: {verification?.full_name_on_document}
              </DialogTitle>
              <Badge variant="secondary" className="capitalize">
                {verification?.document_type}
              </Badge>
              {verification?.overall_confidence_score && (
                <Badge 
                  className={verification.overall_confidence_score >= 90 
                    ? "bg-success" 
                    : verification.overall_confidence_score >= 70 
                      ? "bg-warning" 
                      : "bg-destructive"
                  }
                >
                  {verification.overall_confidence_score}% Confidence
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Shortcuts: +/- zoom, R rotate, 1-3 switch tabs, Esc close</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Main Image Viewer */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="front" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Front (1)
                  </TabsTrigger>
                  {signedUrls.back && (
                    <TabsTrigger value="back" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Back (2)
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="selfie" className="gap-2">
                    <User className="h-4 w-4" />
                    Selfie (3)
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleZoomOut} aria-label="Zoom Out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-16 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} aria-label="Zoom In">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
                <Button variant="ghost" size="icon" onClick={handleRotateCcw} aria-label="Rotate counter-clockwise">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleRotateCw} aria-label="Rotate clockwise">
                  <RotateCw className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
                <Button variant="ghost" size="icon" onClick={handleResetView} aria-label="Reset view">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Image Display */}
            <div className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center p-4">
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading documents...</span>
                </div>
              ) : getCurrentUrl() ? (
                <div 
                  className="transition-transform duration-200"
                  style={{ 
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center'
                  }}
                >
                  <img 
                    src={getCurrentUrl() || ''} 
                    alt={`Document ${activeTab}`}
                    className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-3"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="text-muted-foreground">No image available</div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 px-4 py-3 border-t bg-muted/30 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {onReject && (
                <Button variant="destructive" onClick={onReject} className="min-w-32">
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              )}
              {onApprove && (
                <Button variant="success" onClick={onApprove} className="min-w-32">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              )}
            </div>
          </div>

          {/* Document Info Sidebar */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l overflow-y-auto bg-background shrink-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold mb-1">Document Details</h3>
              <p className="text-xs text-muted-foreground">Submitted document information</p>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">User Information</h4>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Name on Document</p>
                  <p className="font-medium">{verification?.full_name_on_document || '—'}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Document Type</p>
                  <p className="font-medium capitalize">{verification?.document_type || '—'}</p>
                </div>
              </div>

              {verification?.overall_confidence_score !== null && verification?.overall_confidence_score !== undefined && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Scores</h4>
                  <ScoreBar label="Overall" score={verification.overall_confidence_score} />
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScoreBar({ label, score, inverted = false }: { label: string; score: number; inverted?: boolean }) {
  const displayScore = Math.round(score);
  const colorClass = inverted 
    ? (displayScore >= 80 ? 'bg-success' : displayScore >= 50 ? 'bg-warning' : 'bg-destructive')
    : (displayScore >= 80 ? 'bg-success' : displayScore >= 60 ? 'bg-warning' : 'bg-destructive');

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{displayScore}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all duration-300`}
          style={{ width: `${displayScore}%` }}
        />
      </div>
    </div>
  );
}
