// useRentyFlow.ts
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_KEY!
);

export function useRentyFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const confirmBooking = async (data: any) => {
    setLoading(true);
    const { error } = await supabase.from("bookings").insert([data]);
    setLoading(false);

    if (!error) router.push("/payment");
    else alert("Gagal buat tempahan, cuba lagi.");
  };

  return { step, nextStep, prevStep, confirmBooking, loading };
}
