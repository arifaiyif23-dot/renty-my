import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Maximize2, 
  X,
  Loader2,
  AlertTriangle,
  CheckCircle,
  User,
  FileText
} from "lucide-react";
import { getSignedUrl } from "@/utils/signedUrls";
import { supabase } from "@/integrations/supabase/client";
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
    ai_analysis_result?: any;
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
    const parts = url.split('/storage/v1/object/');
    if (parts.length < 2) {
      const publicParts = url.split('/storage/v1/object/public/');
      if (publicParts.length >= 2) {
        return publicParts[1].split('/').slice(1).join('/');
      }
    } else {
      return parts[1].split('/').slice(1).join('/').replace('public/', '');
    }
    return url.split('verification-documents/').pop() || url;
  }, []);

  useEffect(() => {
    if (open && verification) {
      loadSignedUrls();
      // Reset view state
      setZoom(1);
      setRotation(0);
      setActiveTab("front");
    }
  }, [open, verification]);

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

      // Log access
      await supabase.from('sensitive_data_access_log').insert({
        user_id: verification.user_id,
        resource_type: 'verification_document',
        resource_id: verification.id,
        access_type: 'admin_view_modal'
      });
    } catch (error) {
      console.error("Failed to load signed URLs:", error);
      toast.error("Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

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
      // Don't capture if user is in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case 'r':
          e.preventDefault();
          handleRotateCw();
          break;
        case 'R':
          e.preventDefault();
          handleRotateCcw();
          break;
        case '0':
          e.preventDefault();
          handleResetView();
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
  }, [open, signedUrls.back]);

  const getCurrentUrl = () => {
    switch (activeTab) {
      case "front": return signedUrls.front;
      case "back": return signedUrls.back;
      case "selfie": return signedUrls.selfie;
      default: return null;
    }
  };

  const aiAnalysis = verification?.ai_analysis_result;
  const extractedData = aiAnalysis?.extraction;

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
                    ? "bg-green-500" 
                    : verification.overall_confidence_score >= 70 
                      ? "bg-yellow-500" 
                      : "bg-red-500"
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

        <div className="flex flex-1 overflow-hidden">
          {/* Main Image Viewer */}
          <div className="flex-1 flex flex-col">
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
                <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom Out (-)">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-16 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom In (+)">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
                <Button variant="ghost" size="icon" onClick={handleRotateCcw} title="Rotate CCW (Shift+R)">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleRotateCw} title="Rotate CW (R)">
                  <RotateCw className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-2" />
                <Button variant="ghost" size="icon" onClick={handleResetView} title="Reset View (0)">
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
                    className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : (
                <div className="text-muted-foreground">No image available</div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 px-4 py-3 border-t bg-muted/30">
              {onReject && (
                <Button variant="destructive" onClick={onReject} className="min-w-32">
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              )}
              {onApprove && (
                <Button onClick={onApprove} className="min-w-32 bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              )}
            </div>
          </div>

          {/* AI Analysis Sidebar */}
          <div className="w-80 border-l overflow-y-auto bg-background">
            <div className="p-4 border-b">
              <h3 className="font-semibold mb-1">AI Analysis</h3>
              <p className="text-xs text-muted-foreground">Extracted data and confidence scores</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Extracted Data */}
              {extractedData && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Extracted Information</h4>
                  
                  {extractedData.fullName && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                      <p className="font-medium">{extractedData.fullName}</p>
                    </div>
                  )}
                  
                  {extractedData.icNumber && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">IC Number</p>
                      <p className="font-medium font-mono">{extractedData.icNumber}</p>
                    </div>
                  )}
                  
                  {extractedData.dateOfBirth && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Date of Birth</p>
                      <p className="font-medium">{extractedData.dateOfBirth}</p>
                    </div>
                  )}
                  
                  {extractedData.address && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Address</p>
                      <p className="font-medium text-sm">{extractedData.address}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Confidence Scores */}
              {aiAnalysis && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Confidence Scores</h4>
                  
                  <ScoreBar 
                    label="Document Quality" 
                    score={aiAnalysis.documentQuality?.score || 0} 
                  />
                  <ScoreBar 
                    label="Face Comparison" 
                    score={aiAnalysis.faceComparison?.score || 0} 
                  />
                  <ScoreBar 
                    label="Fraud Detection" 
                    score={100 - (aiAnalysis.fraudDetection?.score || 0)}
                    inverted
                  />
                  <ScoreBar 
                    label="Overall" 
                    score={aiAnalysis.overallConfidence || 0} 
                  />
                </div>
              )}

              {/* Fraud Warnings */}
              {aiAnalysis?.fraudDetection?.concerns?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Concerns
                  </h4>
                  <ul className="space-y-1">
                    {aiAnalysis.fraudDetection.concerns.map((concern: string, i: number) => (
                      <li key={i} className="text-sm bg-orange-500/10 text-orange-700 dark:text-orange-300 rounded px-2 py-1">
                        {concern}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Recommendation */}
              {aiAnalysis?.autoApprove !== undefined && (
                <div className={`p-3 rounded-lg ${aiAnalysis.autoApprove ? 'bg-green-500/10 border border-green-500/30' : 'bg-orange-500/10 border border-orange-500/30'}`}>
                  <p className="text-sm font-medium flex items-center gap-2">
                    {aiAnalysis.autoApprove ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-green-700 dark:text-green-300">AI Recommends Approval</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-orange-700 dark:text-orange-300">Manual Review Required</span>
                      </>
                    )}
                  </p>
                </div>
              )}

              {!aiAnalysis && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No AI analysis available
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
    ? (displayScore >= 80 ? 'bg-green-500' : displayScore >= 50 ? 'bg-yellow-500' : 'bg-red-500')
    : (displayScore >= 80 ? 'bg-green-500' : displayScore >= 60 ? 'bg-yellow-500' : 'bg-red-500');

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
