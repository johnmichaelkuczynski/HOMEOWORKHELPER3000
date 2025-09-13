import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CreditCard, Star, Zap, Crown, Diamond } from "lucide-react";
import PayPalButton from "@/components/PayPalButton";

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  user?: any;
}

const creditTiers = [
  {
    amount: "1",
    tokens: 2000,
    price: "$1",
    icon: Zap,
    description: "Perfect for trying out the service",
    popular: false,
  },
  {
    amount: "10", 
    tokens: 30000,
    price: "$10",
    icon: Star,
    description: "Great for regular homework help",
    popular: true,
  },
  {
    amount: "100",
    tokens: 600000,
    price: "$100", 
    icon: Crown,
    description: "Ideal for heavy academic use",
    popular: false,
  },
  {
    amount: "1000",
    tokens: 10000000,
    price: "$1,000",
    icon: Diamond,
    description: "Ultimate package for institutions",
    popular: false,
  },
];

export function PaymentDialog({ open, onClose, user }: PaymentDialogProps) {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handlePurchase = (amount: string) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to purchase tokens",
        variant: "destructive",
      });
      return;
    }
    setSelectedTier(amount);
  };

  const handlePaymentSuccess = (tokens: number) => {
    toast({
      title: "Payment successful!",
      description: `${tokens.toLocaleString()} tokens have been added to your account`,
    });
    queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    onClose();
  };

  const handlePaymentError = () => {
    toast({
      title: "Payment failed",
      description: "There was an issue processing your payment. Please try again.",
      variant: "destructive",
    });
    setSelectedTier(null);
  };

  const isLoading = false;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Purchase Tokens
          </DialogTitle>
          {user && (
            <div className="text-sm text-muted-foreground">
              Current balance: <span className="font-medium">{user.tokenBalance?.toLocaleString() || 0} tokens</span>
            </div>
          )}
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {creditTiers.map((tier) => {
            const Icon = tier.icon;
            const isSelected = selectedTier === tier.amount;
            const isCurrentlyLoading = isLoading && isSelected;
            
            return (
              <Card 
                key={tier.amount} 
                className={`relative transition-all hover:shadow-md ${
                  tier.popular ? 'ring-2 ring-primary' : ''
                } ${isSelected ? 'ring-2 ring-primary/50' : ''}`}
              >
                {tier.popular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-2">
                    <Icon className={`h-8 w-8 ${tier.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <CardTitle className="text-2xl">{tier.price}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-primary">
                      {tier.tokens.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">tokens</div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-4">
                    ${(parseFloat(tier.amount) / tier.tokens * 1000).toFixed(3)} per 1K tokens
                  </div>
                  {selectedTier === tier.amount ? (
                    <div className="w-full">
                      <PayPalButton
                        amount={tier.amount}
                        currency="USD"
                        intent="capture"
                      />
                    </div>
                  ) : (
                    <Button 
                      className="w-full" 
                      disabled={isLoading}
                      variant={tier.popular ? "default" : "outline"}
                      onClick={() => handlePurchase(tier.amount)}
                    >
                      Purchase {tier.tokens.toLocaleString()} tokens
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">What you get with tokens:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Unlimited homework problem solving</li>
            <li>• Full-length detailed explanations</li>
            <li>• Advanced mathematical notation</li>
            <li>• Graph generation and visualization</li>
            <li>• PDF export capabilities</li>
            <li>• No daily usage limits</li>
          </ul>
        </div>
        
        <div className="text-xs text-muted-foreground text-center mt-4">
          Secure payment powered by PayPal. All transactions are encrypted and secure.
        </div>
      </DialogContent>
    </Dialog>
  );
}