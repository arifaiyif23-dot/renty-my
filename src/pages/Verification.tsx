import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, Upload, CheckCircle, XCircle, Loader2, ArrowLeft, ArrowRight, ShieldCheck, FileText, User } from "lucide-react";
import Header from "@/components/Header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoLivenessCapture } from "@/components/VideoLivenessCapture";

type DocumentType = "mykad" | "passport" | "driving_license";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function Verification() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [documentType, setDocumentType] = useState<DocumentType>("mykad");
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [livenessVideo, setLivenessVideo] = useState<Blob | null>(null);
  const [livenessFrames, setLivenessFrames] = useState<Blob[]>([]);
  const [useVideoLiveness, setUseVideoLiveness] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, stage: '' });
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const progress = (currentStep / 5) * 100;

  const handleFileSelect = (file: File | null, type: 'front' | 'back' | 'selfie') => {
    if (!file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    if (type === 'front') setDocumentFront(file);
    if (type === 'back') setDocumentBack(file);
    if (type === 'selfie') setSelfie(file);
    
    toast.success("Image uploaded successfully");
  };

  const uploadToStorage = async (file: File | Blob, path: string): Promise<string> => {
    const fileExt = file instanceof File ? file.name.split('.').pop() : 'webm';
    const fileName = `${path}-${Date.now()}.${fileExt}`;
    const filePath = `${user?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('verification-documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Return only the path, not the full URL (will use signed URLs for access)
    return filePath;
  };

  const handleVideoCapture = (videoBlob: Blob, frames: Blob[]) => {
    setLivenessVideo(videoBlob);
    setLivenessFrames(frames);
    toast.success("Video liveness check completed!");
  };

  const handleSubmit = async () => {
    if (!documentFront || !selfie) {
      toast.error("Please upload all required documents");
      return;
    }

    if (documentType === "mykad" && !documentBack) {
      toast.error("Please upload back of MyKad");
      return;
    }

    setLoading(true);
    setCurrentStep(5);

    try {
      // Build upload queue so we can show real progress
      type UploadJob = { file: File | Blob; path: string; key: string };
      const jobs: UploadJob[] = [
        { file: documentFront, path: 'document-front', key: 'front' },
        { file: selfie, path: 'selfie', key: 'selfie' },
      ];
      if (documentType === 'mykad' && documentBack) {
        jobs.push({ file: documentBack, path: 'document-back', key: 'back' });
      }
      if (livenessVideo) {
        jobs.push({ file: livenessVideo, path: 'liveness-video', key: 'video' });
      }
      livenessFrames.forEach((frame, idx) => {
        jobs.push({ file: frame, path: `liveness-frame-${idx}`, key: `frame-${idx}` });
      });

      setUploadProgress({ done: 0, total: jobs.length, stage: 'Uploading documents' });

      const uploaded: Record<string, string> = {};
      // Sequential upload for accurate progress + graceful failure messaging
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        try {
          uploaded[job.key] = await uploadToStorage(job.file, job.path);
        } catch (err: any) {
          throw new Error(`Upload failed at ${job.path}: ${err?.message || 'unknown error'}`);
        }
        setUploadProgress({ done: i + 1, total: jobs.length, stage: 'Uploading documents' });
      }

      const frontUrl = uploaded['front'];
      const selfieUrl = uploaded['selfie'];
      const backUrl = uploaded['back'] ?? null;
      const videoUrl = uploaded['video'] ?? null;
      const frameUrls = Object.keys(uploaded)
        .filter((k) => k.startsWith('frame-'))
        .sort()
        .map((k) => uploaded[k]);

      setUploadProgress({ done: jobs.length, total: jobs.length, stage: 'Submitting for review' });

      // Hash IC number if available (MyKad only)
      let icNumberHash = null;
      if (documentType === "mykad") {
        // Note: IC number would be extracted by admin or AI, we just store the hash
        // For now, we'll let the admin/AI system handle this
      }

      // Create verification request for manual admin review
      toast.info("Submitting documents for admin review...");
      
      const { data: verification, error: createError } = await (supabase as any)
        .from('verification_requests')
        .insert({
          user_id: user?.id,
          document_type: documentType,
          document_front_url: frontUrl,
          document_back_url: backUrl,
          selfie_url: selfieUrl,
          video_liveness_url: videoUrl,
          liveness_video_frames: frameUrls.length > 0 ? frameUrls : null,
          ic_number_hash: icNumberHash,
          status: 'pending',
          full_name_on_document: 'Pending Review'
        })
        .select()
        .single();

      if (createError) throw createError;

      setVerificationId(verification.id);

      // All verifications go through manual admin review
      toast.success("Documents submitted successfully! An admin will review your verification shortly.");
      
      setResult({
        success: true,
        autoApproved: false,
        confidence: 0,
        details: { message: "Submitted for manual admin review" }
      });


    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.message || "Failed to submit verification");
      setCurrentStep(4);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !documentType) {
      toast.error("Please select a document type");
      return;
    }
    if (currentStep === 2 && !documentFront) {
      toast.error("Please upload document front");
      return;
    }
    if (currentStep === 3 && documentType === "mykad" && !documentBack) {
      toast.error("Please upload document back");
      return;
    }
    if (currentStep === 4 && !selfie && !livenessVideo) {
      toast.error("Please complete selfie or video liveness check");
      return;
    }

    if (currentStep === 3 && documentType !== "mykad") {
      setCurrentStep(4 as Step);
    } else if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const prevStep = () => {
    if (currentStep === 4 && documentType !== "mykad") {
      setCurrentStep(2 as Step);
    } else if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-3xl pb-mobile-nav">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/profile')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Identity Verification</CardTitle>
                <CardDescription>Verify your identity to unlock premium features</CardDescription>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">Step {currentStep} of 5</p>
          </CardHeader>

          <CardContent>
            {/* Step 1: Document Type Selection */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Select Document Type</h3>
                <Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mykad">Malaysian IC (MyKad)</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="driving_license">Driving License</SelectItem>
                  </SelectContent>
                </Select>
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Requirements:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Clear, well-lit photo</li>
                    <li>• All text must be readable</li>
                    <li>• No glare or shadows</li>
                    <li>• Document must be valid</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 2: Upload Front */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Upload Document Front</h3>
                </div>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'front')}
                />
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {documentFront ? (
                    <div className="space-y-4">
                      <img 
                        src={URL.createObjectURL(documentFront)} 
                        alt="Document front" 
                        className="max-h-64 mx-auto rounded"
                      />
                      <Button variant="outline" onClick={() => frontInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Replace Image
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                      <div>
                        <Button onClick={() => frontInputRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Photo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Upload Back (MyKad only) */}
            {currentStep === 3 && documentType === "mykad" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Upload Document Back</h3>
                </div>
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'back')}
                />
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  {documentBack ? (
                    <div className="space-y-4">
                      <img 
                        src={URL.createObjectURL(documentBack)} 
                        alt="Document back" 
                        className="max-h-64 mx-auto rounded"
                      />
                      <Button variant="outline" onClick={() => backInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Replace Image
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                      <div>
                        <Button onClick={() => backInputRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Photo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Video Liveness or Selfie */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Identity Verification</h3>
                </div>
                
                {useVideoLiveness ? (
                  <VideoLivenessCapture 
                    onCapture={handleVideoCapture}
                    onSkip={() => setUseVideoLiveness(false)}
                  />
                ) : (
                  <>
                    <input
                      ref={selfieInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'selfie')}
                    />
                    <div className="bg-muted p-4 rounded-lg mb-4">
                      <h4 className="font-medium mb-2">Tips for a good selfie:</h4>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Face the camera directly</li>
                        <li>• Ensure good lighting</li>
                        <li>• Remove glasses if possible</li>
                        <li>• Keep a neutral expression</li>
                      </ul>
                    </div>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      {selfie ? (
                        <div className="space-y-4">
                          <img 
                            src={URL.createObjectURL(selfie)} 
                            alt="Selfie" 
                            className="max-h-64 mx-auto rounded"
                          />
                          <Button variant="outline" onClick={() => selfieInputRef.current?.click()}>
                            <Upload className="h-4 w-4 mr-2" />
                            Retake Selfie
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
                          <div>
                            <Button onClick={() => selfieInputRef.current?.click()}>
                              <Camera className="h-4 w-4 mr-2" />
                              Take Selfie
                            </Button>
                          </div>
                          <Button variant="link" onClick={() => setUseVideoLiveness(true)}>
                            Use Video Liveness Instead (More Secure)
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 5: Processing/Results */}
            {currentStep === 5 && (
              <div className="space-y-6 text-center py-8">
                {loading ? (
                  <>
                    <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
                    <h3 className="text-lg font-semibold">
                      {uploadProgress.stage || 'Submitting your verification'}
                    </h3>
                    {uploadProgress.total > 0 && (
                      <>
                        <p className="text-muted-foreground">
                          {uploadProgress.done} of {uploadProgress.total} files uploaded
                        </p>
                        <Progress
                          value={(uploadProgress.done / uploadProgress.total) * 100}
                          className="h-2 max-w-sm mx-auto"
                        />
                      </>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Please keep this page open until submission completes.
                    </p>
                  </>
                ) : result ? (
                  <>
                    {result.autoApproved ? (
                      <>
                        <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                        <h3 className="text-lg font-semibold text-green-500">Verification Approved!</h3>
                        <p className="text-muted-foreground">Your identity has been successfully verified.</p>
                        <Badge variant="secondary" className="text-lg py-2 px-4">
                          Confidence Score: {result.confidence}%
                        </Badge>
                        <Button onClick={() => navigate('/profile')} className="mt-4">
                          Return to Profile
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="h-16 w-16 mx-auto bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                          <Loader2 className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <h3 className="text-lg font-semibold">Under Review</h3>
                        <p className="text-muted-foreground">Your verification requires manual review by our team. We'll notify you within 24-48 hours.</p>
                        <Badge variant="secondary" className="text-lg py-2 px-4">
                          Confidence Score: {result.confidence}%
                        </Badge>
                        <Button onClick={() => navigate('/profile')} className="mt-4">
                          Return to Profile
                        </Button>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* Navigation Buttons */}
            {currentStep < 5 && (
              <div className="flex gap-4 mt-6">
                {currentStep > 1 && (
                  <Button variant="outline" onClick={prevStep} disabled={loading}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                )}
                {currentStep < 4 ? (
                  <Button onClick={nextStep} disabled={loading} className="ml-auto">
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={loading} className="ml-auto">
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Submit Verification
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
