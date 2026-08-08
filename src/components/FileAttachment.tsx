import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, FileImage, File as FileIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface FileAttachmentProps {
  onFileSelect: (url: string, type: string) => void;
  disabled?: boolean;
}

export function FileAttachment({ onFileSelect, disabled }: FileAttachmentProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('File type not supported');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user?.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

      const fileType = file.type.startsWith('image/') ? 'image' : 'document';
      setPreview({ url: publicUrl, type: fileType });
      onFileSelect(publicUrl, fileType);
      toast.success('File uploaded');
    } catch (error: unknown) {
      toast.error('Failed to upload file');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    onFileSelect('', '');
  };

  if (preview) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        {preview.type === 'image' ? (
          <FileImage className="h-4 w-4 text-primary" />
        ) : (
          <FileIcon className="h-4 w-4 text-primary" />
        )}
        <span className="text-sm flex-1 truncate">Attachment ready</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] h-9 w-9 md:h-6 md:w-6"
          onClick={clearPreview}
          aria-label="Remove attachment"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="file"
        id="file-upload"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        accept="image/*,.pdf,.doc,.docx"
      />
      <label htmlFor="file-upload">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || uploading}
          asChild
        >
          <span className="cursor-pointer">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </span>
        </Button>
      </label>
    </div>
  );
}