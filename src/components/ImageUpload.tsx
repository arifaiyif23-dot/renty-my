import { useState, useCallback, useEffect, useRef } from "react";
import { Camera, Image as ImageIcon, Upload, X, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { optimizeImage } from "@/utils/imageOptimization";

interface ImageUploadProps {
  onImagesChange: (urls: string[]) => void;
  maxImages?: number;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'compressing' | 'uploading' | 'complete' | 'error';
}

export const ImageUpload = ({ onImagesChange, maxImages = 5, initialImages = [] }: ImageUploadProps & { initialImages?: string[] }) => {
  const [images, setImages] = useState<string[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const { user } = useAuth();
  const isInitializedRef = useRef(false);
  const prevInitialImagesRef = useRef<string>('');

  // Initialize from initialImages only once on mount
  useEffect(() => {
    if (!isInitializedRef.current && initialImages.length > 0) {
      setImages(initialImages);
      prevInitialImagesRef.current = JSON.stringify(initialImages);
      isInitializedRef.current = true;
    }
  }, [initialImages]);

  // Update when initialImages actually changes (not just length)
  useEffect(() => {
    const currentStr = JSON.stringify(initialImages);
    
    if (currentStr !== prevInitialImagesRef.current && initialImages.length > 0) {
      setImages(initialImages);
      prevInitialImagesRef.current = currentStr;
    }
  }, [initialImages]);

  const uploadImage = useCallback(async (file: File, progressIndex: number): Promise<string | null> => {
    if (!user) {
      toast.error("Authentication required", {
        description: "Please sign in to upload images",
      });
      return null;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.');
      return null;
    }
    
    try {
      // Update progress: Compressing
      setUploadProgress(prev => {
        const updated = [...prev];
        updated[progressIndex] = { fileName: file.name, progress: 10, status: 'compressing' };
        return updated;
      });

      let fileToUpload: File;
      let fileExtension = 'webp';
      
      try {
        // Optimize image (resize + WebP conversion)
        const optimizedBlob = await optimizeImage(file);
        fileToUpload = new File([optimizedBlob], `${file.name.split('.')[0]}.webp`, {
          type: 'image/webp'
        });
      } catch (optimizeError) {
        console.warn('Image optimization failed, uploading original:', optimizeError);
        // Fallback: upload original file if optimization fails
        fileToUpload = file;
        fileExtension = file.name.split('.').pop() || 'jpg';
      }

      // Update progress: Compression complete
      setUploadProgress(prev => {
        const updated = [...prev];
        updated[progressIndex] = { fileName: file.name, progress: 40, status: 'uploading' };
        return updated;
      });

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExtension}`;
      const filePath = `${user.id}/${fileName}`;

      // Update progress during upload
      setUploadProgress(prev => {
        const updated = [...prev];
        updated[progressIndex] = { fileName: file.name, progress: 70, status: 'uploading' };
        return updated;
      });

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

      // Update progress: Complete
      setUploadProgress(prev => {
        const updated = [...prev];
        updated[progressIndex] = { fileName: file.name, progress: 100, status: 'complete' };
        return updated;
      });

      return publicUrl;
    } catch (error: unknown) {
      console.error('Error uploading image:', error);
      
      // Update progress: Error
      setUploadProgress(prev => {
        const updated = [...prev];
        updated[progressIndex] = { fileName: file.name, progress: 0, status: 'error' };
        return updated;
      });
      
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : "We couldn't upload that photo. Please check your connection and try again.",
      });
      return null;
    }
  }, [user]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    const files = Array.from(e.target.files || []);
    
    if (files.length + images.length > maxImages) {
      toast.error("Too many images", {
        description: `You can only upload up to ${maxImages} images`,
      });
      return;
    }

    setUploading(true);
    setUploadProgress(files.map(f => ({ fileName: f.name, progress: 0, status: 'compressing' as const })));
    
    const uploadPromises = files.map((file, index) => uploadImage(file, index));
    const uploadedUrls = await Promise.all(uploadPromises);
    const validUrls = uploadedUrls.filter((url): url is string => url !== null);
    
    setImages(prev => {
      const newImages = [...prev, ...validUrls];
      onImagesChange(newImages);
      return newImages;
    });
    setUploading(false);

    // Clear progress after a short delay
    setTimeout(() => setUploadProgress([]), 1000);

    if (validUrls.length > 0) {
      toast.success(`${validUrls.length} image(s) uploaded and optimized`);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    
    if (files.length + images.length > maxImages) {
      toast.error("Too many images", {
        description: `You can only upload up to ${maxImages} images`,
      });
      return;
    }

    setUploading(true);
    setUploadProgress(files.map(f => ({ fileName: f.name, progress: 0, status: 'compressing' as const })));
    
    const uploadPromises = files.map((file, index) => uploadImage(file, index));
    const uploadedUrls = await Promise.all(uploadPromises);
    const validUrls = uploadedUrls.filter((url): url is string => url !== null);
    
    setImages(prev => {
      const newImages = [...prev, ...validUrls];
      onImagesChange(newImages);
      return newImages;
    });
    setUploading(false);

    // Clear progress after a short delay
    setTimeout(() => setUploadProgress([]), 1000);

    if (validUrls.length > 0) {
      toast.success(`${validUrls.length} image(s) uploaded and optimized`);
    }
  }, [images, maxImages, onImagesChange, uploadImage, uploading]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    // Adjust primary index if needed
    if (index === primaryIndex && newImages.length > 0) {
      setPrimaryIndex(0);
    } else if (index < primaryIndex) {
      setPrimaryIndex(primaryIndex - 1);
    }
    onImagesChange(newImages);
  };

  const setPrimary = (index: number) => {
    // Reorder array so selected image is first
    const newImages = [images[index], ...images.filter((_, i) => i !== index)];
    setImages(newImages);
    setPrimaryIndex(0);
    onImagesChange(newImages);
    toast.success("Cover image updated");
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-border rounded-lg p-6 md:p-8 text-center hover:border-primary transition-colors min-h-[160px]"
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="gallery-upload"
          disabled={uploading || images.length >= maxImages}
        />
        <input
          type="file"
          multiple
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          id="camera-upload"
          disabled={uploading || images.length >= maxImages}
        />
        
        {uploading ? (
          <Loader2 className="h-12 w-12 mx-auto mb-4 text-primary animate-spin" />
        ) : (
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        )}
        <p className="text-sm md:text-base text-muted-foreground mb-4 font-medium">
          {uploading ? "Compressing & uploading..." : "Add photos"}
        </p>
        
        {/* Upload Progress */}
        {uploadProgress.length > 0 && (
          <div className="space-y-2 mb-4">
            {uploadProgress.map((progress) => (
              <div key={progress.fileName} className="text-left">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span className="truncate max-w-[200px]">{progress.fileName}</span>
                  <span>
                    {progress.status === 'compressing' && 'Compressing...'}
                    {progress.status === 'uploading' && 'Uploading...'}
                    {progress.status === 'complete' && '✓ Complete'}
                    {progress.status === 'error' && '✗ Failed'}
                  </span>
                </div>
                <Progress value={progress.progress} className="h-1" />
              </div>
            ))}
          </div>
        )}
        
        <div className="flex gap-3 justify-center mb-4">
          <label htmlFor="camera-upload">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              disabled={uploading || images.length >= maxImages}
              asChild
            >
                <span className="cursor-pointer inline-flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Camera
              </span>
            </Button>
          </label>
          <label htmlFor="gallery-upload">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              disabled={uploading || images.length >= maxImages}
              asChild
            >
                <span className="cursor-pointer inline-flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Gallery
              </span>
            </Button>
          </label>
        </div>
        
        <p className="text-xs md:text-sm text-muted-foreground">
          <span className="font-semibold">{images.length} / {maxImages}</span> images uploaded
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {images.map((url, index) => (
            <div 
              key={url} 
              className="relative group aspect-square cursor-pointer"
              onClick={() => setPrimary(index)}
            >
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className={`w-full h-full object-cover rounded-lg transition-all ${
                  index === primaryIndex ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
                loading="lazy"
                decoding="async"
              />
              <Button
                variant="destructive"
                size="icon"
                aria-label={`Remove image ${index + 1}`}
                className="absolute top-2 right-2 h-8 w-8 md:h-6 md:w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-sm z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
              >
                <X className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
              {index === primaryIndex && (
                <Badge className="absolute bottom-2 left-2 gap-1 bg-primary shadow-sm">
                  <Star className="h-3 w-3 fill-current" />
                  Cover
                </Badge>
              )}
              {index !== primaryIndex && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                  <Badge variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    Tap to set as cover
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
