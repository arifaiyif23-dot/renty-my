import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const status = searchParams.get("status_id");
  const billCode = searchParams.get("billcode");
  const transactionId = searchParams.get("transaction_id");

  // Connect Supabase (service role)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Kalau payment success
  if (status === "1") {
    // update transaction as paid
    await supabase
      .from("wallet_transactions")
      .update({ is_paid: true })
      .eq("toyyibpay_transaction_id", billCode);
  }

  return NextResponse.json({ success: true });
}
