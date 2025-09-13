import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, BookOpen, ArrowRight, Mail } from "lucide-react";
import GPTBypassSection from "@/components/GPTBypassSection";
import { TokenStatus } from "@/components/ui/token-status";
import { PaymentDialog } from "@/components/ui/payment-dialog";
import { AuthDialog } from "@/components/ui/auth-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";

export default function GPTBypassMain() {
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  
  // Authentication and session management
  const { user, isAuthenticated } = useAuth();
  const sessionId = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Contact Us Link - Top */}
      <div className="absolute top-2 left-4 z-10">
        <a
          href="mailto:contact@zhisystems.ai"
          className="text-xs text-slate-600 hover:text-blue-600 underline transition-colors duration-200"
          data-testid="link-contact-us"
        >
          Contact Us
        </a>
      </div>
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            {/* First row: Title and Token Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">GPT BYPASS</h1>
                  <p className="text-sm text-gray-600">AI Text Humanizer</p>
                </div>
              </div>
              
              <TokenStatus
                user={user}
                isAuthenticated={isAuthenticated}
                onShowAuth={() => setShowAuthDialog(true)}
                onShowPayment={() => setShowPaymentDialog(true)}
              />
            </div>
            
            {/* Second row: Navigation */}
            <div className="flex items-center justify-between">
              <nav className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  <Zap className="h-4 w-4" />
                  GPT Bypass
                </div>
                <Link href="/homework">
                  <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                    <BookOpen className="h-4 w-4 mr-2" />
                    ACCESS HOMEWORK ASSISTANT
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </nav>
              
              <div className="text-sm text-gray-500">
                Transform AI text into human-like writing
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Convert AI Text to Human Writing
          </h2>
          <p className="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
            Use advanced AI providers and surgical humanization techniques to transform 
            AI-detected text into natural, human-like writing with zero AI detection scores.
          </p>
          
          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <Badge variant="outline" className="px-3 py-1">
              <Zap className="h-3 w-3 mr-1" />
              Real AI Providers
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              GPTZero Detection
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              Surgical Precision
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              Style Cloning
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              Chunked Processing
            </Badge>
          </div>
        </div>

        {/* Instructions Card */}
        <Card className="mb-8 border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              How to Use GPT BYPASS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-600 font-bold">A</span>
                </div>
                <h3 className="font-semibold mb-2">Box A: Input Text</h3>
                <p className="text-sm text-gray-600">
                  Paste your AI-generated text that needs humanization. Upload PDFs/Word docs supported.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-600 font-bold">B</span>
                </div>
                <h3 className="font-semibold mb-2">Box B: Style Sample</h3>
                <p className="text-sm text-gray-600">
                  Provide a human writing sample to clone its style. Use our presets or upload your own.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-purple-600 font-bold">C</span>
                </div>
                <h3 className="font-semibold mb-2">Box C: Humanized Output</h3>
                <p className="text-sm text-gray-600">
                  Get your humanized text with improved AI detection scores. Re-rewrite as needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main GPT BYPASS Interface */}
        <GPTBypassSection />
      </main>

      {/* Payment Dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        user={user}
      />

      {/* Auth Dialog */}
      <AuthDialog
        open={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        onSuccess={() => {
          setShowAuthDialog(false);
          setTimeout(() => setShowPaymentDialog(true), 500);
        }}
      />
    </div>
  );
}