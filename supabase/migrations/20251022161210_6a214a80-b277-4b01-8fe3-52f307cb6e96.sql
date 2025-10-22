-- Create wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create wallet transaction type enum
CREATE TYPE public.wallet_transaction_type AS ENUM (
  'deposit',
  'withdrawal',
  'rental_payment',
  'rental_earning',
  'refund'
);

-- Create wallet_transactions table
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type wallet_transaction_type NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Wallets policies
CREATE POLICY "Users can view their own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage wallets"
  ON public.wallets FOR ALL
  USING (true)
  WITH CHECK (true);

-- Wallet transactions policies
CREATE POLICY "Users can view their own transactions"
  ON public.wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wallets
      WHERE wallets.id = wallet_transactions.wallet_id
      AND wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create transactions"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (true);

-- Trigger to create wallet when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_wallet();

-- Trigger to update wallet updated_at
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();