import { AlertTriangle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ModerationResult } from '@/utils/contentModeration';

interface ContentModerationFeedbackProps {
  result: ModerationResult | null;
}

export function ContentModerationFeedback({ result }: ContentModerationFeedbackProps) {
  if (!result || (!result.isBlocked && result.detectedKeywords.length === 0)) {
    return null;
  }

  const allDetected = [...result.detectedKeywords, ...result.detectedPatterns];

  if (result.isBlocked) {
    return (
      <Alert variant="destructive" className="mt-4">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Listing Blocked</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>{result.reason}</p>
          {allDetected.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-sm font-medium">Detected:</span>
              {allDetected.slice(0, 5).map((keyword) => (
                <Badge key={keyword} variant="destructive" className="text-xs">
                  {keyword}
                </Badge>
              ))}
              {allDetected.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{allDetected.length - 5} more
                </Badge>
              )}
            </div>
          )}
          <p className="text-sm mt-2">
            <strong>Note:</strong> Only physical items available for rent are allowed. Services, freelance work, or personal contact listings are not permitted.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Warning state - has some keywords but not blocked
  if (result.detectedKeywords.length > 0) {
    return (
      <Alert className="mt-4 border-warning/30 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">Content Warning</AlertTitle>
        <AlertDescription className="text-warning mt-2">
          <p>Your listing contains words that may be flagged. Please ensure you are listing a physical item for rent, not a service.</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {result.detectedKeywords.slice(0, 3).map((keyword) => (
              <Badge key={keyword} variant="outline" className="text-xs border-warning text-warning">
                {keyword}
              </Badge>
            ))}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
