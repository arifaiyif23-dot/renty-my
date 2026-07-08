import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Camera, Video, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VideoLivenessCaptureProps {
  onCapture: (videoBlob: Blob, frames: Blob[]) => void;
  onSkip?: () => void;
}

export const VideoLivenessCapture = ({ onCapture, onSkip }: VideoLivenessCaptureProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("Click 'Start' to begin liveness check");
  const [capturedFrames, setCapturedFrames] = useState<Blob[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error("Camera access error:", error);
      toast.error("Failed to access camera. Please grant camera permissions.");
      throw error;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const captureFrame = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current) {
        reject(new Error("Video not ready"));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to capture frame"));
        }
      }, 'image/jpeg', 0.95);
    });
  };

  const startLivenessCheck = async () => {
    try {
      await startCamera();
      
      // Countdown before recording
      setCountdown(3);
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setCountdown(null);

      // Start recording
      const stream = streamRef.current;
      if (!stream) throw new Error("Stream not available");

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });
      
      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Liveness instructions sequence
      const instructions = [
        { text: "Look straight at the camera", duration: 1500 },
        { text: "Blink twice slowly", duration: 2000 },
        { text: "Turn your head left", duration: 1500 },
        { text: "Turn your head right", duration: 1500 },
        { text: "Smile!", duration: 1000 }
      ];

      const frames: Blob[] = [];

      for (const inst of instructions) {
        setInstruction(inst.text);
        await new Promise(resolve => setTimeout(resolve, inst.duration));
        
        // Capture frame at each instruction
        try {
          const frame = await captureFrame();
          frames.push(frame);
        } catch (error) {
          console.error("Failed to capture frame:", error);
        }
      }

      setCapturedFrames(frames);

      // Set onstop handler BEFORE calling stop to avoid race condition
      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        stopCamera();
        toast.success("Liveness check completed!");
        onCapture(videoBlob, frames);
      };

      // Stop recording
      mediaRecorder.stop();
      setIsRecording(false);
      setInstruction("Processing...");

    } catch (error) {
      console.error("Liveness check error:", error);
      toast.error("Failed to complete liveness check");
      stopCamera();
      setIsRecording(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Video Liveness Check</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          We'll record a short video to verify you're a real person. Follow the on-screen instructions.
        </p>

        <div className="relative bg-muted rounded-lg overflow-hidden aspect-video">
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="text-6xl font-bold text-white">{countdown}</div>
            </div>
          )}
          
          {isRecording && (
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center gap-2 bg-destructive/90 text-white px-3 py-2 rounded-full">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm font-medium">Recording</span>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          {instruction && isRecording && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-primary/90 text-white px-6 py-3 rounded-full text-center">
                <p className="font-semibold">{instruction}</p>
              </div>
            </div>
          )}

          {!isRecording && !countdown && streamRef.current === null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Camera className="w-16 h-16 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">{instruction}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!isRecording && capturedFrames.length === 0 && (
            <>
              <Button
                onClick={startLivenessCheck}
                className="flex-1"
              >
                <Video className="w-4 h-4 mr-2" />
                Start Liveness Check
              </Button>
              {onSkip && (
                <Button
                  onClick={onSkip}
                  variant="outline"
                >
                  Skip (Use Photo)
                </Button>
              )}
            </>
          )}
          
          {capturedFrames.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Liveness check completed ({capturedFrames.length} frames captured)
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};