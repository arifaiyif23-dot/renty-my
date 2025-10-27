-- Add completion confirmation fields to rentals table
ALTER TABLE public.rentals 
ADD COLUMN owner_confirmed_completion boolean DEFAULT false,
ADD COLUMN renter_confirmed_completion boolean DEFAULT false;