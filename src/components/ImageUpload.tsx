import { useState, useCallback } from "react";
import { Upload, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { toast as sonnerToast } from "sonner";

interface ImageUploadProps {
  onImagesChange: (urls: string[]) => void;
  maxImages?: number;
}

export const ImageUpload = ({ onImagesChange, maxImages = 5 }: ImageUploadProps) => {
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length + images.length > maxImages) {
      toast({
        title: "Too many images",
        description: `You can only upload up to ${maxImages} images`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    
    const uploadPromises = files.map(file => uploadImage(file));
    const uploadedUrls = await Promise.all(uploadPromises);
    const validUrls = uploadedUrls.filter((url): url is string => url !== null);
    
    const newImages = [...images, ...validUrls];
    setImages(newImages);
    onImagesChange(newImages);
    setUploading(false);

    toast({
      title: "Success",
      description: `${validUrls.length} image(s) uploaded`,
    });
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    if (files.length + images.length > maxImages) {
      toast({
        title: "Too many images",
        description: `You can only upload up to ${maxImages} images`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    
    const uploadPromises = files.map(file => uploadImage(file));
    const uploadedUrls = await Promise.all(uploadPromises);
    const validUrls = uploadedUrls.filter((url): url is string => url !== null);
    
    const newImages = [...images, ...validUrls];
    setImages(newImages);
    onImagesChange(newImages);
    setUploading(false);

    toast({
      title: "Success",
      description: `${validUrls.length} image(s) uploaded`,
    });
  }, [images, maxImages, onImagesChange, toast]);

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
    sonnerToast.success("Cover image updated");
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
        
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm md:text-base text-muted-foreground mb-4 font-medium">
          {uploading ? "Uploading..." : "Add photos"}
        </p>
        
        <div className="flex gap-3 justify-center mb-4">
          <label htmlFor="camera-upload">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              disabled={uploading || images.length >= maxImages}
              asChild
            >
              <span className="cursor-pointer">
                📷 Camera
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
              <span className="cursor-pointer">
                🖼️ Gallery
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
              key={index} 
              className="relative group aspect-square cursor-pointer"
              onClick={() => setPrimary(index)}
            >
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className={`w-full h-full object-cover rounded-lg transition-all ${
                  index === primaryIndex ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 md:h-6 md:w-6 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
              >
                <X className="h-5 w-5 md:h-4 md:w-4" />
              </Button>
              {index === primaryIndex && (
                <Badge className="absolute bottom-2 left-2 gap-1 bg-primary shadow-lg">
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
