import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, Brain, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIAnalysisResult {
  extractedInfo?: {
    fullName?: string;
    documentNumber?: string;
    dateOfBirth?: string;
    qualityScore?: number;
    isDocumentLegible?: boolean;
    documentTypeDetected?: string;
    expiryDate?: string;
  };
  faceMatchResult?: {
    faceMatchScore?: number;
    livenessScore?: number;
    facesDetected?: boolean;
    matchConfidence?: 'high' | 'medium' | 'low' | 'no_match';
  };
  fraudIndicators?: {
    riskScore?: number;
    flags?: string[];
    isHighRisk?: boolean;
  };
  overallConfidence?: number;
  autoApprove?: boolean;
  processingTimeMs?: number;
  model?: string;
  reasoning?: string;
}

interface AIAnalysisCardProps {
  analysis: AIAnalysisResult;
  compact?: boolean;
}

export function AIAnalysisCard({ analysis, compact = false }: AIAnalysisCardProps) {
  if (!analysis) return null;

  const confidence = analysis.overallConfidence || 0;
  const faceMatch = analysis.faceMatchResult?.faceMatchScore || 0;
  const quality = analysis.extractedInfo?.qualityScore || 0;
  const liveness = analysis.faceMatchResult?.livenessScore || 0;
  const riskScore = analysis.fraudIndicators?.riskScore || 0;

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getRiskColor = (score: number) => {
    if (score <= 20) return "text-green-600";
    if (score <= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getMatchBadge = (confidence: string | undefined) => {
    switch (confidence) {
      case 'high':
        return <Badge className="bg-green-500">High Match</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500 text-black">Medium Match</Badge>;
      case 'low':
        return <Badge className="bg-orange-500">Low Match</Badge>;
      default:
        return <Badge variant="destructive">No Match</Badge>;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <Brain className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("font-bold", getConfidenceColor(confidence))}>
              {confidence}%
            </span>
            <span className="text-sm text-muted-foreground">confidence</span>
            {analysis.autoApprove && (
              <Badge className="bg-green-500 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Auto-Approve
              </Badge>
            )}
          </div>
        </div>
        {getMatchBadge(analysis.faceMatchResult?.matchConfidence)}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Analysis</span>
          {analysis.model && (
            <Badge variant="outline" className="text-xs">
              {analysis.model}
            </Badge>
          )}
        </div>
        {analysis.processingTimeMs && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {(analysis.processingTimeMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      {/* Auto-Approve Recommendation */}
      {analysis.autoApprove ? (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-600">Recommended for Auto-Approval</p>
            <p className="text-sm text-muted-foreground">High confidence, no fraud indicators detected</p>
          </div>
        </div>
      ) : analysis.fraudIndicators?.isHighRisk ? (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <div>
            <p className="font-medium text-red-600">High Risk - Manual Review Required</p>
            <p className="text-sm text-muted-foreground">Potential fraud indicators detected</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <Info className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-600">Manual Review Recommended</p>
            <p className="text-sm text-muted-foreground">Confidence below auto-approval threshold</p>
          </div>
        </div>
      )}

      {/* Scores Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreItem 
          label="Overall" 
          score={confidence} 
          colorClass={getConfidenceColor(confidence)}
          progressColor={getProgressColor(confidence)}
        />
        <ScoreItem 
          label="Face Match" 
          score={faceMatch} 
          colorClass={getConfidenceColor(faceMatch)}
          progressColor={getProgressColor(faceMatch)}
        />
        <ScoreItem 
          label="Doc Quality" 
          score={quality} 
          colorClass={getConfidenceColor(quality)}
          progressColor={getProgressColor(quality)}
        />
        <ScoreItem 
          label="Liveness" 
          score={liveness} 
          colorClass={getConfidenceColor(liveness)}
          progressColor={getProgressColor(liveness)}
        />
      </div>

      {/* Fraud Risk */}
      <div className="flex items-center justify-between p-3 bg-background rounded-lg">
        <span className="text-sm font-medium">Fraud Risk Score</span>
        <div className="flex items-center gap-2">
          <span className={cn("font-bold", getRiskColor(riskScore))}>
            {riskScore}%
          </span>
          {riskScore <= 20 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {riskScore > 20 && riskScore <= 50 && <Info className="h-4 w-4 text-yellow-600" />}
          {riskScore > 50 && <AlertTriangle className="h-4 w-4 text-red-600" />}
        </div>
      </div>

      {/* Fraud Flags */}
      {analysis.fraudIndicators?.flags && analysis.fraudIndicators.flags.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Detected Issues:</span>
          <div className="flex flex-wrap gap-2">
            {analysis.fraudIndicators.flags.map((flag, i) => (
              <Badge key={i} variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {flag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Info */}
      {analysis.extractedInfo && (
        <div className="space-y-2 pt-2 border-t">
          <span className="text-sm font-medium">Extracted Information:</span>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {analysis.extractedInfo.fullName && (
              <div>
                <span className="text-muted-foreground">Name:</span>{' '}
                <span className="font-medium">{analysis.extractedInfo.fullName}</span>
              </div>
            )}
            {analysis.extractedInfo.documentNumber && (
              <div>
                <span className="text-muted-foreground">Doc No:</span>{' '}
                <span className="font-medium">{analysis.extractedInfo.documentNumber.slice(0, 6)}****</span>
              </div>
            )}
            {analysis.extractedInfo.dateOfBirth && (
              <div>
                <span className="text-muted-foreground">DOB:</span>{' '}
                <span className="font-medium">{analysis.extractedInfo.dateOfBirth}</span>
              </div>
            )}
            {analysis.extractedInfo.documentTypeDetected && (
              <div>
                <span className="text-muted-foreground">Type:</span>{' '}
                <span className="font-medium capitalize">{analysis.extractedInfo.documentTypeDetected}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Reasoning */}
      {analysis.reasoning && (
        <div className="pt-2 border-t">
          <span className="text-sm font-medium">AI Reasoning:</span>
          <p className="text-sm text-muted-foreground mt-1">{analysis.reasoning}</p>
        </div>
      )}
    </div>
  );
}

function ScoreItem({ 
  label, 
  score, 
  colorClass, 
  progressColor 
}: { 
  label: string; 
  score: number; 
  colorClass: string;
  progressColor: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-bold", colorClass)}>{score}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all", progressColor)} 
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
