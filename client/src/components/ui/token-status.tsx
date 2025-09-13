import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Coins, CreditCard, LogOut, User, Zap } from "lucide-react";
import { AuthDialog } from "./auth-dialog";
import { PaymentDialog } from "./payment-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TokenStatusProps {
  sessionId?: string;
}

export function TokenStatus({ sessionId }: TokenStatusProps) {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: user, isLoading: userLoading, error } = useQuery<any>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const response = await fetch("/api/me", {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return null; // Not authenticated
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    retry: false,
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/logout");
      return response.json();
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      // Force refresh the user state
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      // Small delay then refresh page to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
  });

  const handleLogin = () => {
    setShowAuthDialog(true);
  };

  const handleBuyCredits = () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    setShowPaymentDialog(true);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toLocaleString();
  };

  if (userLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    // Free user
    return (
      <>
        <Card className="w-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Free Usage</span>
                <Badge variant="outline" className="text-xs">
                  1000 tokens total
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLogin}
                  className="text-xs"
                >
                  <User className="h-3 w-3 mr-1" />
                  Login
                </Button>
                <Button
                  size="sm"
                  onClick={handleBuyCredits}
                  className="text-xs"
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  Upgrade
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-1">
                One-time allowance: 1000 tokens total
              </div>
              <div className="text-xs text-muted-foreground">
                Register for unlimited access
              </div>
            </div>
          </CardContent>
        </Card>

        <AuthDialog
          open={showAuthDialog}
          onClose={() => setShowAuthDialog(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/me"] });
          }}
        />
        
        <PaymentDialog
          open={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          user={user}
        />
      </>
    );
  }

  // Registered user
  const tokenBalance = user.tokenBalance || 0;
  const isLowBalance = tokenBalance < 1000;
  const isVeryLowBalance = tokenBalance < 100;

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className={`h-4 w-4 ${isVeryLowBalance ? 'text-red-500' : isLowBalance ? 'text-orange-500' : 'text-green-500'}`} />
              <span className="text-sm font-medium">
                {formatTokens(tokenBalance)} tokens
              </span>
              {isVeryLowBalance && (
                <Badge variant="destructive" className="text-xs">
                  Very Low
                </Badge>
              )}
              {isLowBalance && !isVeryLowBalance && (
                <Badge variant="secondary" className="text-xs">
                  Low
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleBuyCredits}
                className="text-xs"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Buy Credits
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                className="text-xs"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Logout
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-muted-foreground mb-1">
              {user.username || user.email}
            </div>
            {isLowBalance && (
              <div className="text-xs text-orange-600">
                Consider purchasing more tokens for uninterrupted service
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PaymentDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        user={user}
      />
    </>
  );
}