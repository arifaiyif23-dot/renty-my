import { supabase } from "@/integrations/supabase/client";

// Default expiration: 15 minutes for enhanced security
const DEFAULT_URL_EXPIRATION = 900; // 15 minutes in seconds

// Shorter expiration for sensitive documents (verification docs, IDs)
const SENSITIVE_DOC_EXPIRATION = 600; // 10 minutes in seconds

export const getSignedUrl = async (path: string, expiresIn: number = DEFAULT_URL_EXPIRATION): Promise<string> => {
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

export const isPublicUrl = (value: string): boolean => /^https?:\/\//i.test(value);

// Resolves a stored evidence value to a displayable URL. Legacy rows store a
// full public URL; new rows store a storage path like `rental-evidence/<...>`.
export const getEvidenceUrl = async (value: string): Promise<string> => {
  if (isPublicUrl(value)) return value;
  return getSignedUrl(value);
};

export const getVerificationDocumentUrl = async (documentUrl: string, userId: string): Promise<string> => {
  // Extract the file path from the full URL
  const fileName = documentUrl.split('/').pop();
  const path = `verification-documents/${userId}/${fileName}`;
  
  // Use shorter expiration for sensitive verification documents
  return getSignedUrl(path, SENSITIVE_DOC_EXPIRATION);
};
