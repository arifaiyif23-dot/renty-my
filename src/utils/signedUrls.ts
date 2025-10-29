import { supabase } from "@/integrations/supabase/client";

export const getSignedUrl = async (path: string, expiresIn: number = 3600): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-signed-url', {
      body: { path, expiresIn }
    });

    if (error) throw error;
    if (!data || !data.signedUrl) throw new Error('Failed to generate signed URL');

    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
};

export const getVerificationDocumentUrl = async (documentUrl: string, userId: string): Promise<string> => {
  // Extract the file path from the full URL
  const fileName = documentUrl.split('/').pop();
  const path = `verification-documents/${userId}/${fileName}`;
  
  return getSignedUrl(path);
};
