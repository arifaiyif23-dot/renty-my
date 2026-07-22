import { supabase } from "@/integrations/supabase/client";

const VERIFIED_LEVELS = ["basic", "kyc", "premium"];

export async function getVerifiedUserIds(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .in("verification_level", VERIFIED_LEVELS)
      .limit(1000);
    return data?.map((p) => p.id) || [];
  } catch {
    return [];
  }
}
