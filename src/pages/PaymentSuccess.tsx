import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status_id');

  useEffect(() => {
    const timer = setTimeout(() => navigate('/dashboard'), 5000);
    return () => clearTimeout(timer);
  }, [navigate]);

  if (status === '1') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-muted-foreground mb-6">
            Your rental has been confirmed. The owner will prepare the item for you.
          </p>
          <Button onClick={() => navigate('/dashboard')} className="w-full">
            View My Rentals
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full p-8 text-center">
        <XCircle className="h-20 w-20 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Payment Failed</h1>
        <p className="text-muted-foreground mb-6">
          Your payment could not be processed. Please try again.
        </p>
        <Button onClick={() => navigate('/')} className="w-full">
          Back to Home
        </Button>
      </Card>
    </div>
  );
}
