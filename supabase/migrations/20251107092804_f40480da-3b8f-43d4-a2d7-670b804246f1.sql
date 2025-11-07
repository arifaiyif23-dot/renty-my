-- Enable realtime for verification_requests and fraud_alerts tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.verification_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_alerts;