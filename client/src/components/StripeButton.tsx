import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CreditCard } from "lucide-react";

interface StripeButtonProps {
  amount: string;
  tokens: number;
  onSuccess?: () => void;
  onError?: () => void;
}

export default function StripeButton({ amount, tokens, onSuccess, onError }: StripeButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCheckoutSession = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/create-checkout-session`, {
        amount: amount,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.url) {
        // Open Stripe checkout in new window to bypass iframe restrictions
        const checkoutWindow = window.open(data.url, '_blank', 'width=800,height=600');
        
        if (checkoutWindow) {
          setIsProcessing(true);
          
          // Poll for payment completion with timeout
          let pollStartTime = Date.now();
          const POLL_TIMEOUT = 3 * 60 * 1000; // 3 minutes timeout
          
          const pollPaymentStatus = async () => {
            try {
              // Check for timeout (3 minutes)
              if (Date.now() - pollStartTime > POLL_TIMEOUT) {
                setIsProcessing(false);
                if (checkoutWindow && !checkoutWindow.closed) {
                  checkoutWindow.close();
                }
                toast({
                  title: "Payment processing timeout",
                  description: "Payment is taking longer than expected. Please check your account or try again.",
                  variant: "destructive",
                });
                onError?.();
                return;
              }
              
              const statusResponse = await apiRequest("GET", `/api/payment-status/${data.sessionId}`);
              const statusData = await statusResponse.json();
              
              console.log(`[STRIPE FRONTEND] Payment status: ${statusData.status}`);
              
              if (statusData.status === 'completed') {
                setIsProcessing(false);
                // Close the popup window
                if (checkoutWindow && !checkoutWindow.closed) {
                  checkoutWindow.close();
                }
                toast({
                  title: "Payment successful!",
                  description: `${tokens.toLocaleString()} tokens have been added to your account`,
                });
                queryClient.invalidateQueries({ queryKey: ["/api/me"] });
                onSuccess?.();
                return;
              } else if (statusData.status === 'failed') {
                setIsProcessing(false);
                // Close the popup window
                if (checkoutWindow && !checkoutWindow.closed) {
                  checkoutWindow.close();
                }
                toast({
                  title: "Payment failed",
                  description: "Your payment was not completed. Please try again.",
                  variant: "destructive",
                });
                onError?.();
                return;
              }
              
              // Check if window was closed manually by user, but only after checking payment status
              // This prevents race conditions where the window closes just as payment completes
              if (checkoutWindow.closed) {
                // Give one final check for payment completion before marking as cancelled
                try {
                  const finalStatusResponse = await apiRequest("GET", `/api/payment-status/${data.sessionId}`);
                  const finalStatusData = await finalStatusResponse.json();
                  
                  if (finalStatusData.status === 'completed') {
                    // Payment actually completed! Show success
                    setIsProcessing(false);
                    toast({
                      title: "Payment successful!",
                      description: `${tokens.toLocaleString()} tokens have been added to your account`,
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/me"] });
                    onSuccess?.();
                    return;
                  }
                } catch (error) {
                  console.error('Final status check failed:', error);
                }
                
                // Only show cancelled if payment definitely didn't complete
                setIsProcessing(false);
                toast({
                  title: "Payment cancelled",
                  description: "The payment window was closed.",
                  variant: "destructive",
                });
                onError?.();
                return;
              }
              
              // Continue polling if still pending
              setTimeout(pollPaymentStatus, 2000);
            } catch (error) {
              console.error('Error checking payment status:', error);
              // Continue polling even on errors, but respect timeout
              setTimeout(pollPaymentStatus, 2000);
            }
          };
          
          // Start polling after a short delay
          setTimeout(pollPaymentStatus, 3000);
          
        } else {
          toast({
            title: "Popup blocked",
            description: "Please allow popups for this site and try again.",
            variant: "destructive",
          });
        }
      }
    },
    onError: (error: any) => {
      console.error('Stripe checkout error:', error);
      toast({
        title: "Payment setup failed",
        description: "Unable to setup payment. Please try again.",
        variant: "destructive",
      });
      onError?.();
    },
  });

  const handleClick = () => {
    createCheckoutSession.mutate();
  };

  return (
    <Button 
      onClick={handleClick}
      disabled={createCheckoutSession.isPending || isProcessing}
      className="w-full bg-[#635bff] hover:bg-[#5a52e8] text-white"
      data-testid={`stripe-button-${amount}`}
    >
      {createCheckoutSession.isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Setting up payment...
        </>
      ) : isProcessing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Payment processing...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          Pay with Stripe
        </>
      )}
    </Button>
  );
}