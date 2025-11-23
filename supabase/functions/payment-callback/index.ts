import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

// Verify ToyyibPay signature (optional - for enhanced security)
function verifyToyyibPaySignature(params: URLSearchParams, secretKey: string): boolean {
  const signature = params.get('signature');
  if (!signature) return false;

  const signatureParams = new URLSearchParams(params);
  signatureParams.delete('signature');
  
  const sortedParams = Array.from(signatureParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  const computedSignature = createHmac('sha256', secretKey)
    .update(sortedParams)
    .digest('hex');
  
  return computedSignature === signature;
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const billCode = url.searchParams.get('billcode');
    const status = url.searchParams.get('status_id');
    const transactionId = url.searchParams.get('transaction_id');
    const paymentId = url.searchParams.get('order_id');
    
    console.log('ToyyibPay callback:', { billCode, status, transactionId, paymentId });
    
    // SECURITY: Verify signature (uncomment when ToyyibPay adds signature support)
    // const secretKey = Deno.env.get('TOYYIBPAY_SECRET_KEY')!;
    // if (!verifyToyyibPaySignature(url.searchParams, secretKey)) {
    //   console.error('Invalid ToyyibPay signature');
    //   return new Response('Unauthorized', { status: 401 });
    // }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { data: payment } = await supabase
      .from('payments')
      .select('*, rental:rentals(*)')
      .eq('id', paymentId)
      .single();
    
    if (!payment) {
      console.error('Payment not found:', paymentId);
      return new Response('Payment not found', { status: 404 });
    }
    
    if (status === '1') {
      // Payment successful
      await supabase
        .from('payments')
        .update({
          status: 'paid',
          toyyibpay_transaction_id: transactionId,
          toyyibpay_signature: url.searchParams.get('signature'),
          payment_verified_at: new Date().toISOString(),
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentId);
      
      await supabase
        .from('rentals')
        .update({ status: 'approved' })
        .eq('id', payment.rental_id);
      
      // Notifications
      await supabase.from('notifications').insert([
        {
          user_id: payment.rental.renter_id,
          type: 'rental_approved',
          title: 'Payment Successful',
          message: 'Your rental payment has been confirmed. The item is ready for pickup!',
          link: `/dashboard`
        },
        {
          user_id: payment.rental.owner_id,
          type: 'rental_request',
          title: 'New Rental (Paid)',
          message: 'A renter has paid for your item. Please prepare it for pickup.',
          link: `/dashboard`
        }
      ]);
      
      console.log('Payment successful:', paymentId);
      
      // Trigger n8n workflow for receipt generation
      const n8nWebhookUrl = Deno.env.get('N8N_RECEIPT_WEBHOOK_URL');
      if (n8nWebhookUrl) {
        const webhookPayload = {
          paymentId,
          rentalId: payment.rental_id,
          renterId: payment.rental.renter_id,
          ownerId: payment.rental.owner_id,
          amount: payment.total_amount,
          transactionId
        };
        
        // Create initial log entry
        const { data: logEntry } = await supabase
          .from('workflow_logs')
          .insert({
            workflow_name: 'payment-receipt-generation',
            payment_id: paymentId,
            trigger_data: webhookPayload,
            status: 'pending'
          })
          .select()
          .single();
        
        try {
          const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
          });
          
          const responseText = await response.text();
          
          if (response.ok) {
            console.log('n8n receipt workflow triggered successfully');
            
            // Update log to success
            if (logEntry) {
              await supabase
                .from('workflow_logs')
                .update({
                  status: 'success',
                  response_data: { statusCode: response.status, body: responseText }
                })
                .eq('id', logEntry.id);
            }
          } else {
            console.error('Failed to trigger n8n workflow:', responseText);
            
            // Update log to failed
            if (logEntry) {
              await supabase
                .from('workflow_logs')
                .update({
                  status: 'failed',
                  error_message: `HTTP ${response.status}: ${responseText}`,
                  response_data: { statusCode: response.status, body: responseText }
                })
                .eq('id', logEntry.id);
            }
          }
        } catch (error) {
          console.error('Error triggering n8n workflow:', error);
          
          // Update log to failed
          if (logEntry) {
            await supabase
              .from('workflow_logs')
              .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : String(error)
              })
              .eq('id', logEntry.id);
          }
        }
      }
      
    } else if (status === '3') {
      // Payment failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', paymentId);
      
      await supabase
        .from('rentals')
        .update({ status: 'cancelled' })
        .eq('id', payment.rental_id);
      
      console.log('Payment failed:', paymentId);
    }
    
    return new Response('OK', { status: 200 });
    
  } catch (error) {
    console.error('Callback error:', error);
    return new Response('Error', { status: 500 });
  }
});
