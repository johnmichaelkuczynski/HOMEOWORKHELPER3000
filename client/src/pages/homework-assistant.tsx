import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputWithVoice } from "@/components/ui/input-with-voice";
import { Textarea } from "@/components/ui/textarea";
import { TextareaWithVoice } from "@/components/ui/textarea-with-voice";
import { MathTextarea } from "@/components/ui/math-textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { MathRenderer } from "@/components/ui/math-renderer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Copy, Trash2, CheckCircle, History, Lightbulb, Download, Edit3, Save, X, ArrowDown, FileText, Mail, Printer, RotateCcw, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TokenStatus } from "@/components/ui/token-status";
import { PaymentDialog } from "@/components/ui/payment-dialog";
import { AuthDialog } from "@/components/ui/auth-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useSession } from "@/hooks/use-session";
import GPTBypassSection from "@/components/GPTBypassSection";

import { useQuery, useMutation } from "@tanstack/react-query";

export default function HomeworkAssistant() {
  const [inputText, setInputText] = useState("");
  const [currentAssignmentName, setCurrentAssignmentName] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("deepseek");
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [wordCount, setWordCount] = useState(0);
  const [aiDetectionResult, setAiDetectionResult] = useState<any>(null);
  const [isCheckingAI, setIsCheckingAI] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatFileUpload, setChatFileUpload] = useState<File | null>(null);
  const [critiqueText, setCritiqueText] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [isEditingTopSolution, setIsEditingTopSolution] = useState(false);
  const [isEditingBottomSolution, setIsEditingBottomSolution] = useState(false);
  const [editedTopSolution, setEditedTopSolution] = useState("");
  const [editedBottomSolution, setEditedBottomSolution] = useState("");
  const [isChunkedProcessing, setIsChunkedProcessing] = useState(false);
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 0 });
  const [accumulatedContent, setAccumulatedContent] = useState("");
  const [selectedSavedAssignment, setSelectedSavedAssignment] = useState("");
  const [savedAssignments, setSavedAssignments] = useState<{[key: string]: string}>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [assignmentName, setAssignmentName] = useState("");
  const [showRefineDialog, setShowRefineDialog] = useState(false);
  const [refinementFeedback, setRefinementFeedback] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isMathViewEnabled, setIsMathViewEnabled] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [gptBypassText, setGptBypassText] = useState("");
  const [solutionAiScore, setSolutionAiScore] = useState<number | null>(null);
  const [isAnalyzingSolution, setIsAnalyzingSolution] = useState(false);
  const [inputAiScore, setInputAiScore] = useState<number | null>(null);
  const [isAnalyzingInput, setIsAnalyzingInput] = useState(false);

  // Authentication and session management
  const { user, isAuthenticated } = useAuth();
  const sessionId = useSession();

  // Function to send homework solution to GPT BYPASS Box A
  const sendSolutionToGptBypass = () => {
    if (!currentResult?.llmResponse) {
      toast({
        title: "No solution to send",
        description: "Generate a homework solution first",
        variant: "destructive",
      });
      return;
    }
    
    setGptBypassText(currentResult.llmResponse);
    
    // Scroll to GPT BYPASS section
    const gptBypassElement = document.querySelector('[data-testid="gpt-bypass-section"]');
    if (gptBypassElement) {
      gptBypassElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    toast({
      title: "Solution sent to GPT BYPASS",
      description: "Text copied to Box A for humanization",
    });
  };

  // Function to receive text from GPT BYPASS Box C to assignment details
  const receiveFromGptBypass = (text: string) => {
    setInputText(text);
    
    // Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    toast({
      title: "Text received from GPT BYPASS",
      description: "Humanized text added to Assignment Details",
    });
  };


  // Function to clear everything and start new assignment
  const handleNewAssignment = () => {
    setInputText("");
    setCurrentAssignmentName("");
    setSpecialInstructions("");
    setCurrentResult(null);
    setWordCount(0);
    setAiDetectionResult(null);
    setSolutionAiScore(null);
    setInputAiScore(null);
    setChatMessages([]);
    setChatInput("");
    setChatFileUpload(null);
    setCritiqueText("");
    setEditedTopSolution("");
    setEditedBottomSolution("");
    setRefinementFeedback("");
    setShowRefineDialog(false);
    setAccumulatedContent("");
    setSelectedSavedAssignment("");
    setAssignmentName("");
    setIsEditingTopSolution(false);
    setIsEditingBottomSolution(false);
    setIsChunkedProcessing(false);
    setChunkProgress({ current: 0, total: 0 });
    toast({
      title: "New assignment started",
      description: "All fields have been cleared",
    });
  };

  const { toast } = useToast();

  const assignmentsQuery = useQuery<any[]>({
    queryKey: ['/api/assignments'],
    enabled: true
  });
  
  const { data: allAssignments } = assignmentsQuery;

  // Load saved assignments from database on component mount
  useEffect(() => {
    console.log('All assignments received:', allAssignments);
    if (allAssignments && allAssignments.length > 0) {
      const saved: {[key: string]: string} = {};
      allAssignments.forEach(assignment => {
        console.log('Processing assignment:', assignment);
        // Try both fileName and file_name, and inputText and input_text
        const fileName = assignment.fileName || assignment.file_name;
        const inputText = assignment.inputText || assignment.input_text;
        
        if (fileName && inputText) {
          saved[fileName] = inputText;
          console.log(`Added saved assignment: ${fileName}`);
        }
      });
      console.log('Final saved assignments:', saved);
      setSavedAssignments(saved);
    }
  }, [allAssignments]);

  // Nuclear option: Force global drag/drop to work in Replit preview
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const textarea = document.querySelector('textarea');
      if (!textarea) {
        console.log("No textarea found.");
        return;
      }

      // Plain text drag
      if (e.dataTransfer?.types.includes('text/plain')) {
        const text = e.dataTransfer.getData('text/plain');
        setInputText(text);
      } 
      // File drag
      else if (e.dataTransfer?.files.length && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (evt.target?.result) {
            setInputText(evt.target.result as string);
          }
        };
        reader.readAsText(file);
      }
    };

    document.addEventListener('dragover', handleDragOver, { passive: false });
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Word count function
  const calculateWordCount = (text: string) => {
    if (!text) {
      setWordCount(0);
      return;
    }
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  };

  // Function to clean markdown formatting from text
  const cleanMarkdown = (text: string) => {
    return text
      .replace(/#{1,6}\s*/g, '') // Remove all header markers (# ## ### etc)
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
      .replace(/`(.*?)`/g, '$1') // Remove code formatting
      .replace(/^\s*[-*+]\s+/gm, '') // Remove bullet points
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered lists
      .replace(/^\s*>\s+/gm, '') // Remove blockquotes
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links but keep text
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/---+/g, '') // Remove horizontal rules
      .replace(/\*{3,}/g, '') // Remove emphasis markers
      .replace(/_{3,}/g, '') // Remove underline emphasis
      .trim();
  };

  // AI detection function using GPTZero (for homework solutions)
  const analyzeSolutionAI = async (text: string) => {
    if (!text.trim()) return;
    
    try {
      setIsAnalyzingSolution(true);
      const response = await fetch('/api/humanize/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const result = await response.json();
      setSolutionAiScore(result.aiScore);
    } catch (error) {
      console.error('Solution AI analysis error:', error);
      setSolutionAiScore(null);
    } finally {
      setIsAnalyzingSolution(false);
    }
  };

  // AI detection function using GPTZero
  const checkAIDetection = async (text: string) => {
    if (!text) return;
    
    setIsCheckingAI(true);
    try {
      const response = await fetch('/api/ai-detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setAiDetectionResult(result);
      } else {
        setAiDetectionResult({ error: 'AI detection service unavailable' });
      }
    } catch (error) {
      console.error('AI detection failed:', error);
      setAiDetectionResult({ error: 'AI detection unavailable' });
    } finally {
      setIsCheckingAI(false);
    }
  };

  // AI detection function for input text
  const analyzeInputAI = async (text: string) => {
    if (!text.trim()) {
      setInputAiScore(null);
      return;
    }
    
    try {
      setIsAnalyzingInput(true);
      const response = await fetch('/api/humanize/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze input');
      }
      
      const result = await response.json();
      setInputAiScore(result.aiScore);
    } catch (error) {
      console.error('Input AI analysis error:', error);
      setInputAiScore(null);
    } finally {
      setIsAnalyzingInput(false);
    }
  };

  // Helper functions for AI score formatting (matching GPT Bypass)
  const getAIScoreColor = (score: number) => {
    if (score >= 80) return "text-red-600 font-bold";
    if (score >= 50) return "text-yellow-600 font-bold";
    if (score >= 20) return "text-blue-600 font-bold";
    return "text-green-600 font-bold";
  };

  const getAIScoreText = (score: number) => {
    return `${score}% AI / ${100 - score}% HUMAN`;
  };

  // Refine solution function
  const handleRefineSolution = async () => {
    if (!refinementFeedback.trim() || !currentResult) return;
    
    setIsRefining(true);
    
    try {
      const response = await fetch('/api/refine-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalProblem: currentResult.extractedText || inputText,
          currentSolution: currentResult.llmResponse,
          feedback: refinementFeedback,
          provider: selectedProvider,
          sessionId: sessionId
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update the current result with the refined solution
        setCurrentResult({
          ...currentResult,
          llmResponse: result.refinedSolution,
          processingTime: result.processingTime
        });
        
        // Clear and close the refinement dialog
        setRefinementFeedback("");
        setShowRefineDialog(false);
        
        toast({
          title: "Solution Refined",
          description: "Your solution has been improved based on your feedback.",
        });
      } else {
        throw new Error(result.error || 'Failed to refine solution');
      }
    } catch (error) {
      console.error('Error refining solution:', error);
      toast({
        title: "Error",
        description: "Failed to refine solution. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefining(false);
    }
  };

  // Chat with AI function
  const handleChatMessage = async () => {
    if (!chatInput.trim() && !chatFileUpload) return;
    
    const userMessage = { role: 'user', content: chatInput || (chatFileUpload ? `Uploaded file: ${chatFileUpload.name}` : ''), timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    
    const currentChatInput = chatInput;
    const currentFile = chatFileUpload;
    setChatInput("");
    setChatFileUpload(null);
    setIsChatting(true);

    try {
      let response, result;
      
      if (currentFile) {
        // Handle file upload in chat
        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('provider', selectedProvider);
        formData.append('sessionId', sessionId);
        if (currentChatInput) formData.append('message', currentChatInput);
        if (chatMessages.length > 0) {
          formData.append('conversationHistory', JSON.stringify(chatMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))));
        }
        
        response = await fetch('/api/chat-upload', {
          method: 'POST',
          body: formData,
        });
        result = await response.json();
      } else {
        // Handle text-only chat
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: currentChatInput, 
            provider: selectedProvider,
            sessionId: sessionId,
            conversationHistory: chatMessages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            context: currentResult ? {
              problem: currentResult.extractedText || inputText,
              solution: currentResult.llmResponse
            } : null
          }),
        });
        result = await response.json();
      }
      
      const aiMessage = { 
        role: 'assistant', 
        content: result.response, 
        timestamp: new Date(),
        extractedText: result.extractedText,
        fileName: result.fileName
      };
      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat failed:', error);
      const errorMessage = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date() };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatting(false);
    }
  };

  // Handle file upload for chat
  const handleChatFileUpload = (file: File) => {
    setChatFileUpload(file);
  };

  // Send chat response to input box
  const sendToInputBox = (content: string) => {
    setInputText(content);
  };

  // Handle save assignment
  const handleSaveAssignment = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Nothing to save",
        description: "Please enter some content first",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await fetch('/api/save-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: inputText,
          title: currentAssignmentName || inputText.substring(0, 50) + '...',
        }),
      });
      
      if (response.ok) {
        toast({
          title: "Assignment saved",
          description: "Your assignment has been saved successfully",
        });
        setCurrentAssignmentName("");
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save assignment",
        variant: "destructive",
      });
    }
  };

  // Handle email solution
  const handleEmailSolution = async (email: string, content: string, title: string) => {
    console.log('Email function called with:', { email, content: content?.substring(0, 50), title });
    
    if (!email || !content) {
      toast({
        title: "Missing information",
        description: "Email address and content are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/email-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, content, title }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: "Email sent",
          description: `Solution sent to ${email}`,
        });
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error: any) {
      toast({
        title: "Email failed",
        description: error.message || "Failed to send email. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Critique and rewrite function
  const handleCritiqueRewrite = async () => {
    if (!critiqueText.trim() || !currentResult) return;
    
    setIsRewriting(true);
    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          originalSolution: currentResult.llmResponse,
          critique: critiqueText,
          provider: selectedProvider,
          problem: currentResult.extractedText || inputText,
          sessionId: sessionId
        }),
      });
      
      const result = await response.json();
      setCurrentResult((prev: any) => ({ ...prev, llmResponse: result.rewrittenSolution }));
      calculateWordCount(result.rewrittenSolution);
      setCritiqueText("");
      toast({
        title: "Solution rewritten",
        description: "The solution has been updated based on your critique",
      });
    } catch (error) {
      console.error('Rewrite failed:', error);
      toast({
        title: "Rewrite failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsRewriting(false);
    }
  };









  // Print/Save as PDF function that preserves math notation
  const handlePrintSaveAsPDF = () => {
    if (!currentResult?.llmResponse) {
      toast({
        title: "No content to print",
        description: "Please generate a solution first",
        variant: "destructive",
      });
      return;
    }

    // Get the actual rendered math content
    const mathContentElement = document.querySelector('.math-content');
    if (!mathContentElement) {
      toast({
        title: "Content not ready",
        description: "Please wait for the solution to render completely",
        variant: "destructive",
      });
      return;
    }

    // Clone the content to preserve math rendering
    const clonedContent = mathContentElement.cloneNode(true) as HTMLElement;
    
    // Create a new window for printing with proper math rendering
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast({
        title: "Popup blocked",
        description: "Please allow popups to use print function",
        variant: "destructive",
      });
      return;
    }

    // Write complete HTML with MathJax and proper styling for print
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${(currentAssignmentName || 'Assignment Solution').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
    
    <!-- MathJax Configuration for Print -->
    <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
        processEscapes: true,
        packages: {'[+]': ['ams', 'amsmath', 'amssymb', 'cancel', 'color']}
      },
      chtml: {
        scale: 1.2,
        minScale: 0.8,
        matchFontHeight: false,
        displayAlign: 'center'
      },
      startup: {
        ready: () => {
          MathJax.startup.defaultReady();
          MathJax.startup.promise.then(() => {
            window.mathJaxComplete = true;
          });
        }
      }
    };
    </script>
    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    
    <style>
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            color: #000;
            background: white;
            font-size: 14pt;
        }
        h1, h2, h3 {
            color: #000;
            margin: 1em 0 0.5em 0;
            font-weight: bold;
            page-break-after: avoid;
        }
        h1 { font-size: 20pt; }
        h2 { font-size: 18pt; }
        h3 { font-size: 16pt; }
        p {
            margin-bottom: 1em;
            text-align: justify;
            page-break-inside: avoid;
        }
        .math-content {
            font-size: 14pt;
            line-height: 1.8;
        }
        mjx-container {
            margin: 0.8em 0 !important;
            page-break-inside: avoid;
            overflow: visible !important;
        }
        mjx-container[display="block"] {
            text-align: center;
            margin: 1.2em 0 !important;
        }
        .problem-section {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .solution-section {
            margin-top: 20px;
        }
        @media print {
            body {
                max-width: none;
                margin: 0;
                padding: 15px;
                font-size: 12pt;
            }
            .problem-section {
                background: #f8f9fa !important;
                border: 1px solid #000 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            mjx-container {
                page-break-inside: avoid;
                overflow: visible !important;
            }
            h1, h2, h3 {
                page-break-after: avoid;
            }
        }
        @page {
            margin: 0.75in;
            size: letter;
        }
    </style>
</head>
<body>
    <h1>${(currentAssignmentName || 'Assignment Solution').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
    
    ${currentResult.extractedText ? `
    <div class="problem-section">
        <h2>Problem Statement</h2>
        <p>${currentResult.extractedText.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    </div>
    ` : ''}
    
    <div class="solution-section">
        <h2>Solution</h2>
        ${currentResult.graphImage ? `<img src="data:image/png;base64,${currentResult.graphImage}" alt="Generated Graph" style="max-width: 100%; height: auto; margin: 20px 0; display: block; border: 1px solid #ddd; border-radius: 4px; page-break-inside: avoid;" />` : ''}
        <div class="math-content">${clonedContent.innerHTML}</div>
    </div>
    
    <script>
        // Wait for MathJax to complete rendering before printing
        function waitForMathJax() {
            return new Promise((resolve) => {
                if (window.mathJaxComplete) {
                    resolve(true);
                } else if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
                    window.MathJax.startup.promise.then(() => {
                        setTimeout(() => {
                            window.mathJaxComplete = true;
                            resolve(true);
                        }, 1500);
                    });
                } else {
                    setTimeout(() => waitForMathJax().then(resolve), 200);
                }
            });
        }
        
        // Auto-print when everything is ready
        window.addEventListener('load', function() {
            waitForMathJax().then(() => {
                setTimeout(() => {
                    window.print();
                }, 500);
            });
        });
        
        // Close window after printing
        window.addEventListener('afterprint', function() {
            window.close();
        });
        
        // Fallback close for cancelled print
        window.addEventListener('beforeunload', function() {
            setTimeout(() => {
                if (!window.closed) {
                    window.close();
                }
            }, 1000);
        });
    </script>
</body>
</html>
    `);
    
    printWindow.document.close();
    
    toast({
      title: "Print dialog opened",
      description: "Select 'Save as PDF' to download with preserved math notation",
    });
  };

  // Chunked processing function
  const processInChunks = async (text: string, provider: string) => {
    const words = text.trim().split(/\s+/);
    
    // Check if we need chunking (more than 1000 words)
    if (words.length <= 1000) {
      // Process normally for small requests
      return;
    }

    setIsChunkedProcessing(true);
    setAccumulatedContent("");
    
    // Calculate chunks
    const chunkSize = 800; // Slightly smaller to leave room for context
    const totalChunks = Math.ceil(words.length / chunkSize);
    setChunkProgress({ current: 0, total: totalChunks });

    let fullResponse = "";

    for (let i = 0; i < totalChunks; i++) {
      const startIdx = i * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, words.length);
      const chunkWords = words.slice(startIdx, endIdx);
      
      setChunkProgress({ current: i + 1, total: totalChunks });

      // Create chunk-specific prompt
      let chunkPrompt;
      if (i === 0) {
        chunkPrompt = `Please write the first part (approximately ${chunkWords.length} words) of: ${text}

This is part 1 of ${totalChunks}. Focus on a strong introduction and the beginning of the main content.`;
      } else if (i === totalChunks - 1) {
        chunkPrompt = `Please write the final part (approximately ${chunkWords.length} words) of: ${text}

This is part ${i + 1} of ${totalChunks}. Focus on conclusions and final thoughts. Here's what has been written so far for context:

${fullResponse.slice(-1000)}...`;
      } else {
        chunkPrompt = `Please write part ${i + 1} of ${totalChunks} (approximately ${chunkWords.length} words) of: ${text}

Continue from where the previous part left off. Here's what has been written so far for context:

${fullResponse.slice(-1000)}...`;
      }

      try {
        const response = await fetch('/api/process-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            inputText: chunkPrompt, 
            inputType: 'text',
            llmProvider: provider,
            sessionId: sessionId
          }),
        });

        const result = await response.json();
        
        if (response.ok) {
          const cleanedResponse = cleanMarkdown(result.llmResponse);
          fullResponse += cleanedResponse + "\n\n";
          const cleanedFullResponse = cleanMarkdown(fullResponse);
          setAccumulatedContent(cleanedFullResponse);
          
          // Update the current result with accumulated content
          setCurrentResult((prev: any) => ({
            ...prev,
            llmResponse: cleanedFullResponse,
            extractedText: text
          }));
          
          calculateWordCount(cleanedFullResponse);
        } else {
          throw new Error(result.error || 'Chunk processing failed');
        }
      } catch (error) {
        console.error(`Chunk ${i + 1} failed:`, error);
        toast({
          title: `Chunk ${i + 1} failed`,
          description: "Continuing with remaining chunks...",
          variant: "destructive",
        });
      }
    }

    setIsChunkedProcessing(false);
    toast({
      title: "Large assignment completed",
      description: `Processed ${totalChunks} chunks successfully`,
    });
  };

  const uploadMutation = useMutation({
    mutationFn: ({ file, provider }: { file: File; provider: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('llmProvider', provider);
      formData.append('sessionId', sessionId);
      return fetch('/api/upload', {
        method: 'POST',
        body: formData,
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      setCurrentResult(data);
      // Keep the extracted text in the input box so user can save it
      if (data.extractedText) {
        setInputText(data.extractedText);
      }
      // Automatically analyze AI detection for the solution
      if (data.llmResponse) {
        analyzeSolutionAI(data.llmResponse);
      }
      calculateWordCount(data.llmResponse);
      toast({
        title: "Assignment processed successfully",
        description: `Solution generated by ${getProviderDisplayName(selectedProvider)}`,
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to process assignment";
      
      // Check if it's a token-related error
      if (errorMessage.includes("insufficient tokens") || errorMessage.includes("token")) {
        toast({
          title: "Insufficient tokens",
          description: "Please purchase more tokens to continue or register for an account",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Processing failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const textMutation = useMutation({
    mutationFn: ({ text, provider }: { text: string; provider: string }) => {
      return fetch('/api/process-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inputText: text, 
          inputType: 'text',
          llmProvider: provider,
          sessionId: sessionId
        }),
      }).then(res => res.json());
    },
    onSuccess: (data) => {
      // Clean markdown from the response
      const cleanedResponse = cleanMarkdown(data.llmResponse);
      const cleanedData = { ...data, llmResponse: cleanedResponse };
      
      setCurrentResult(cleanedData);
      calculateWordCount(cleanedResponse);
      // Automatically analyze AI detection for the solution
      if (cleanedResponse) {
        analyzeSolutionAI(cleanedResponse);
      }
      toast({
        title: "Assignment processed successfully",
        description: `Solution generated by ${getProviderDisplayName(selectedProvider)}`,
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to process assignment";
      
      // Check if it's a token-related error
      if (errorMessage.includes("insufficient tokens") || errorMessage.includes("token")) {
        toast({
          title: "Insufficient tokens",
          description: "Please purchase more tokens to continue or register for an account",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Processing failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  const handleFileSelect = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/extract-text', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to extract text from file');
      }
      
      const data = await response.json();
      setInputText(data.extractedText);
      
      toast({
        title: "File processed",
        description: "Text extracted and ready for processing",
      });
    } catch (error: any) {
      toast({
        title: "File extraction failed",
        description: error.message || "Could not extract text from file",
        variant: "destructive",
      });
    }
  };

  const handleProcessText = async () => {
    if (!inputText.trim()) {
      toast({
        title: "No content to process",
        description: "Please enter some text or upload a file",
        variant: "destructive",
      });
      return;
    }

    const textToProcess = specialInstructions.trim() 
      ? `${inputText}\n\nSpecial Instructions: ${specialInstructions}`
      : inputText;

    // Check if we need chunked processing
    const words = textToProcess.trim().split(/\s+/);
    if (words.length > 1000) {
      await processInChunks(textToProcess, selectedProvider);
    } else {
      textMutation.mutate({ text: textToProcess, provider: selectedProvider });
    }
  };

  const isProcessing = uploadMutation.isPending || textMutation.isPending || isChunkedProcessing;



  const handlePrint = async () => {
    if (!currentResult) return;

    const title = currentAssignmentName || 'Assignment Solution';

    // Handle multiple graphs - download combined PDF according to 1+n protocol
    if (currentResult.graphImages && Array.isArray(currentResult.graphImages) && currentResult.graphImages.length > 0) {
      try {
        // Use the new combined PDF endpoint that creates 1+n documents in a single PDF
        const combinedResponse = await fetch('/api/generate-combined-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: currentResult.llmResponse,
            title: title,
            extractedText: currentResult.extractedText,
            graphImages: currentResult.graphImages,
            graphData: currentResult.graphData
          })
        });

        if (combinedResponse.ok) {
          const combinedBlob = await combinedResponse.blob();
          const combinedUrl = window.URL.createObjectURL(combinedBlob);
          const combinedLink = document.createElement('a');
          combinedLink.href = combinedUrl;
          combinedLink.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_complete.pdf`;
          document.body.appendChild(combinedLink);
          combinedLink.click();
          document.body.removeChild(combinedLink);
          window.URL.revokeObjectURL(combinedUrl);
          
          const graphCount = currentResult.graphImages.length;
          toast({
            title: "Complete solution downloaded",
            description: `Downloaded ${1 + graphCount} documents combined: ${graphCount} graph(s) + 1 solution PDF`,
          });
          return;
        }
      } catch (error) {
        console.error('Combined download error:', error);
        toast({
          title: "Combined download failed",
          description: "Falling back to individual downloads",
          variant: "destructive",
        });
      }
    }

    // Legacy support for single graph
    if (currentResult.graphImage) {
      try {
        // Download the graph PDF first
        const graphResponse = await fetch('/api/generate-graph-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            graphImage: currentResult.graphImage,
            title: `${title} - Graph`
          })
        });

        if (graphResponse.ok) {
          const graphBlob = await graphResponse.blob();
          const graphUrl = window.URL.createObjectURL(graphBlob);
          const graphLink = document.createElement('a');
          graphLink.href = graphUrl;
          graphLink.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_graph.pdf`;
          document.body.appendChild(graphLink);
          graphLink.click();
          document.body.removeChild(graphLink);
          window.URL.revokeObjectURL(graphUrl);
          
          toast({
            title: "Graph downloaded",
            description: "Graph PDF downloaded. Now downloading solution PDF...",
          });
        }
      } catch (error) {
        console.error('Graph download error:', error);
        toast({
          title: "Graph download failed",
          description: "Continuing with solution download",
          variant: "destructive",
        });
      }
    }

    // Get the already-rendered math from the current page
    const mathContentElement = document.querySelector('.math-content');
    if (!mathContentElement) {
      toast({
        title: "Content not ready",
        description: "Please wait for the solution to render completely",
        variant: "destructive",
      });
      return;
    }

    // Clone the rendered content and extract the HTML
    const clonedContent = mathContentElement.cloneNode(true) as HTMLElement;
    const renderedHTML = clonedContent.innerHTML;

    // Create a new window for printing with pre-rendered math
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Popup blocked",
        description: "Please allow popups and try again",
        variant: "destructive",
      });
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Assignment Solution</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Computer Modern', 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.8;
            margin: 1in;
            color: black;
            background: white;
            max-width: none;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid black;
            padding-bottom: 15px;
            margin-bottom: 25px;
        }
        .header h1 {
            font-size: 20pt;
            margin-bottom: 10px;
            font-weight: bold;
        }
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .section h2 {
            font-size: 16pt;
            margin-bottom: 15px;
            color: black;
            font-weight: bold;
            page-break-after: avoid;
        }
        .content {
            font-size: 12pt;
            line-height: 1.8;
        }
        /* Preserve all MathJax styling */
        mjx-container, .mjx-chtml, .MathJax {
            display: inline-block !important;
            font-size: 120% !important;
            line-height: 1.8 !important;
            margin: 0.1em !important;
        }
        mjx-container[display="true"] {
            display: block !important;
            text-align: center !important;
            margin: 1em 0 !important;
        }
        /* Ensure math symbols display correctly */
        .mjx-math {
            color: black !important;
        }
        p {
            margin-bottom: 12pt;
            text-align: justify;
        }
        @page {
            margin: 1in;
            size: letter;
        }
        @media print {
            body { 
                margin: 0; 
                font-size: 12pt;
            }
            mjx-container, .mjx-chtml, .MathJax {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color: black !important;
            }
        }
    </style>
</head>
<body onload="setTimeout(function(){window.print();}, 1000);">
    <div class="header">
        <h1>Assignment Solution</h1>
        <p>Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
    </div>
    
    ${currentResult.extractedText ? `
    <div class="section">
        <h2>Problem:</h2>
        <div class="content">${currentResult.extractedText}</div>
    </div>
    ` : ''}
    
    <div class="section">
        <h2>Solution:</h2>
        ${currentResult.graphImages && currentResult.graphImages.length > 0 ? 
          currentResult.graphImages.map(img => 
            `<div style="text-align: center; margin: 20px 0;"><img src="data:image/png;base64,${img}" alt="Generated Graph" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; page-break-inside: avoid;" /></div>`
          ).join('') : ''}
        <div class="content">${renderedHTML}</div>
    </div>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    toast({
      title: "PDF Preview Ready",
      description: "Print dialog opened. Use 'Save as PDF' in the print dialog for best results.",
    });
  };
  
  const handleCopyToClipboard = () => {
    if (!currentResult) return;
    
    const textToCopy = `${currentAssignmentName ? `Assignment: ${currentAssignmentName}\n\n` : ''}${
      currentResult.extractedText ? `Problem: ${currentResult.extractedText}\n\n` : ''
    }Solution:\n${currentResult.llmResponse}`;
    
    navigator.clipboard.writeText(textToCopy);
    toast({
      title: "Copied to clipboard",
      description: "Solution copied successfully",
    });
  };

  const clearResult = () => {
    setCurrentResult(null);
    setInputText("");
    setCurrentAssignmentName("");
    setSpecialInstructions("");
  };

  // Save assignment to database
  const saveAssignment = async () => {
    const textToSave = inputText.trim() || currentResult?.extractedText?.trim();
    if (!textToSave) {
      toast({
        title: "Nothing to save",
        description: "Please enter some text or upload a document first",
        variant: "destructive",
      });
      return;
    }
    setShowSaveDialog(true);
  };

  const confirmSave = async () => {
    if (!assignmentName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this assignment",
        variant: "destructive",
      });
      return;
    }

    try {
      const textToSave = inputText.trim() || currentResult?.extractedText?.trim();
      
      const response = await fetch('/api/save-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: assignmentName,
          inputText: textToSave
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save assignment');
      }

      toast({
        title: "Assignment saved",
        description: `Saved as "${assignmentName}"`,
      });
      
      setShowSaveDialog(false);
      setAssignmentName("");
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Load assignment from saved list
  const loadAssignment = (name: string) => {
    if (savedAssignments[name]) {
      setInputText(savedAssignments[name]);
      toast({
        title: "Assignment loaded",
        description: `Loaded "${name}"`,
      });
    }
  };

  // Delete saved assignment
  const deleteAssignment = (name: string) => {
    const updated = { ...savedAssignments };
    delete updated[name];
    setSavedAssignments(updated);
    localStorage.setItem('savedAssignments', JSON.stringify(updated));
    
    toast({
      title: "Assignment deleted",
      description: `Deleted "${name}"`,
    });
  };

  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case "deepseek": return "ZHI 3";
      case "anthropic": return "ZHI 1";
      case "openai": return "ZHI 2";
      case "azure": return "ZHI 5";
      case "perplexity": return "ZHI 4";
      default: return provider;
    }
  };

  // Word count calculation helper
  const getWordCount = (text: string): number => {
    if (!text?.trim()) return 0;
    return text.trim().split(/\s+/).length;
  };



  const handleLoadAssignment = (id: number) => {
    // Load saved assignment logic would go here
    toast({
      title: "Loading assignment",
      description: "This feature is being implemented",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
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
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Homework Assistant</h1>
                <p className="text-sm text-slate-600 mt-1">AI-powered assignment solver</p>
              </div>
              {/* Token Status - Full width on its own line */}
              <div className="flex-1 max-w-md ml-8">
                <TokenStatus sessionId={sessionId} />
              </div>
            </div>
            
            {/* Controls on separate row */}
            <div className="flex items-center justify-end space-x-3">
              <Button
                onClick={handleNewAssignment}
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                New Assignment
              </Button>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">ZHI 1</SelectItem>
                  <SelectItem value="openai">ZHI 2</SelectItem>
                  <SelectItem value="deepseek">ZHI 3 (Default)</SelectItem>
                  <SelectItem value="perplexity">ZHI 4</SelectItem>
                  <SelectItem value="azure">ZHI 5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Input Panel */}
          <Card className="flex flex-col">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Assignment Details</h2>
                <Button
                  onClick={() => {
                    // Clear input and output areas only
                    setInputText("");
                    setSpecialInstructions("");
                    setCurrentResult(null);
                    setWordCount(0);
                    setChatMessages([]);
                    setChatInput("");
                    setChatFileUpload(null);
                    setEditedTopSolution("");
                    setEditedBottomSolution("");
                    setAccumulatedContent("");
                    setIsEditingTopSolution(false);
                    setIsEditingBottomSolution(false);
                    // Clear any file uploads
                    const fileInputs = document.querySelectorAll('input[type="file"]');
                    fileInputs.forEach(input => (input as HTMLInputElement).value = '');
                    toast({
                      title: "Cleared",
                      description: "Input and output areas have been cleared",
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900 border-slate-300"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
              
              {/* Load Saved Assignments */}
              {assignmentsQuery.data && assignmentsQuery.data.filter(a => a.fileName).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Load Saved Assignment
                  </label>
                  <div className="flex space-x-2">
                    <Select 
                      value={selectedSavedAssignment} 
                      onValueChange={async (value) => {
                        setSelectedSavedAssignment(value);
                        if (value) {
                          try {
                            const response = await fetch(`/api/assignments/${value}`);
                            if (response.ok) {
                              const assignment = await response.json();
                              setInputText(assignment.inputText || assignment.extractedText || '');
                              setCurrentAssignmentName(assignment.fileName || '');
                              toast({
                                title: "Assignment loaded",
                                description: `Loaded "${assignment.fileName}"`,
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "Failed to load assignment",
                              description: "Please try again",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a saved assignment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {assignmentsQuery.data
                          .filter(assignment => assignment.fileName) // Only show assignments with names
                          .map((assignment) => (
                          <SelectItem key={assignment.id} value={assignment.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <span>{assignment.fileName}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (selectedSavedAssignment) {
                          try {
                            const response = await fetch(`/api/assignments/${selectedSavedAssignment}`, {
                              method: 'DELETE'
                            });
                            if (response.ok) {
                              assignmentsQuery.refetch();
                              setSelectedSavedAssignment("");
                              toast({
                                title: "Assignment deleted",
                                description: "Assignment removed successfully",
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "Failed to delete",
                              description: "Please try again",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                      disabled={!selectedSavedAssignment}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/assignments/cleanup', {
                          method: 'POST'
                        });
                        if (response.ok) {
                          assignmentsQuery.refetch();
                          toast({
                            title: "Cleanup completed",
                            description: "Removed assignments without names",
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "Cleanup failed",
                          description: "Please try again",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Clean up empty assignments
                  </Button>
                </div>
              )}

              {/* Main Question Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Enter Your Question or Problem
                  </label>
                  <Button
                    onClick={() => setInputText("")}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-500 hover:text-red-600"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
                <MathTextarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleProcessText();
                    }
                  }}
                  placeholder="Type, paste, or speak your homework question here... (Enter to solve, Shift+Enter for new line)"
                  className="min-h-[200px] resize-none w-full text-base"
                  disabled={isProcessing}
                  showMathPreview={true}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Supports: LaTeX math notation ($x^2$, $$\int_0^\infty$$), images with mathematical content, PDF documents
                </p>
              </div>

              {/* File Upload */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Or Upload Document/Image
                </label>
                <FileUpload 
                  onFileSelect={handleFileSelect}
                  isProcessing={isProcessing}
                />
              </div>

              {/* Special Instructions - Collapsed by default */}
              <details className="group">
                <summary className="text-sm font-medium text-slate-700 cursor-pointer hover:text-slate-900">
                  Special Instructions (Optional)
                </summary>
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600">LaTeX math notation supported</span>
                    <Button
                      onClick={() => setSpecialInstructions("")}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-500 hover:text-red-600"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <MathTextarea
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Add special instructions... (e.g., 'Show all steps', 'Use substitution method', 'Explain in detail')"
                    className="min-h-[80px] resize-none w-full"
                    showMathPreview={true}
                  />
                </div>
              </details>

              {/* Save Assignment - Always Visible */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-700">Save This Assignment</h3>
                  <Button
                    onClick={() => setCurrentAssignmentName("")}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-slate-500 hover:text-red-600"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="flex space-x-2">
                  <InputWithVoice
                    value={currentAssignmentName}
                    onChange={(e) => setCurrentAssignmentName(e.target.value)}
                    placeholder="Enter assignment title..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveAssignment();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSaveAssignment}
                    variant="outline"
                    size="sm"
                    disabled={!inputText.trim()}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6 mt-auto">
              <div className="flex gap-2">
                <Button 
                  onClick={handleProcessText}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Solve This Problem
                    </>
                  )}
                </Button>
              </div>
              
              <div className="mt-3 text-center">
                <p className="text-xs text-slate-500">
                  Direct passthrough to <span className="font-medium">{getProviderDisplayName(selectedProvider)}</span> • No interference
                </p>
              </div>
            </div>
          </Card>

          {/* Solution Panel */}
          <Card className="flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Solution</h2>
              
              {currentResult && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrint}
                    title="Print/Save as PDF"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyToClipboard}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearResult}
                    title="Clear results"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={sendSolutionToGptBypass}
                    title="Send to GPT BYPASS for humanization"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    Send to GPT BYPASS
                  </Button>
                </div>
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isProcessing && !accumulatedContent && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                    {isChunkedProcessing ? (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Processing large assignment with {getProviderDisplayName(selectedProvider)}...
                        </p>
                        <p className="text-xs text-slate-500">
                          Chunk {chunkProgress.current} of {chunkProgress.total}
                        </p>
                        <div className="w-64 bg-slate-200 rounded-full h-2 mx-auto">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(chunkProgress.current / chunkProgress.total) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400">
                          Results will appear as each chunk completes
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">
                        Processing with {getProviderDisplayName(selectedProvider)}...
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Show accumulated content during chunked processing */}
              {isChunkedProcessing && accumulatedContent && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                      <Lightbulb className="w-4 h-4 mr-2" />
                      Problem:
                    </h3>
                    <p className="text-sm text-blue-800 font-mono bg-white p-3 rounded border">
                      Large assignment being processed in chunks...
                    </p>
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                        <CheckCircle className="w-5 h-5 mr-2 text-emerald-500" />
                        Solution <span className="text-sm text-slate-500 ml-2">(In Progress - Chunk {chunkProgress.current} of {chunkProgress.total})</span>
                      </h3>
                      <div className="w-32 bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(chunkProgress.current / chunkProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="relative">
                      <MathRenderer 
                        content={accumulatedContent}
                        className="space-y-4 math-content pr-12"
                      />
                    </div>
                  </div>
                </div>
              )}

              {!currentResult && !isProcessing && (
                <div className="flex items-center justify-center h-64 text-center">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Lightbulb className="w-8 h-8 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Ready to solve</p>
                      <p className="text-xs text-slate-500 mt-1">Enter your question and click "Solve This Problem"</p>
                    </div>
                  </div>
                </div>
              )}

              {currentResult && (
                <div className="space-y-6">
                  {/* Problem Statement */}
                  {currentResult.extractedText && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                        <Lightbulb className="w-4 h-4 mr-2" />
                        Problem:
                      </h3>
                      <p className="text-sm text-blue-800 font-mono bg-white p-3 rounded border whitespace-pre-wrap">
                        {currentResult.extractedText}
                      </p>
                    </div>
                  )}
                  
                  {/* Solution */}
                  <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                          <CheckCircle className="w-5 h-5 mr-2 text-emerald-500" />
                          Solution
                        </h3>
                      </div>
                      
                      {/* MATH TOGGLE BUTTON - VERY PROMINENT */}
                      <div className="w-full flex justify-center mb-6">
                        <Button
                          onClick={() => setIsMathViewEnabled(!isMathViewEnabled)}
                          className={`px-8 py-4 text-xl font-bold rounded-lg shadow-lg transition-all ${
                            isMathViewEnabled 
                              ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700" 
                              : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
                          }`}
                        >
                          {isMathViewEnabled ? "📐 MATH VIEW (Click for Edit)" : "📝 EDIT VIEW (Click for Math)"}
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRefineDialog(true)}
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Refine Solution
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePrint}
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <Printer className="w-4 h-4 mr-2" />
                          Print/PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyToClipboard}
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </Button>
                      </div>
                    </div>
                    
                    {/* Multiple Graphs Display - According to Multi-Graph Protocol */}
                    {currentResult.graphImages && Array.isArray(currentResult.graphImages) && currentResult.graphImages.length > 0 && (
                      <div className="mb-6 space-y-4">
                        <h4 className="text-md font-medium text-slate-900 mb-3 flex items-center">
                          📊 Generated Graphs ({currentResult.graphImages.length})
                        </h4>
                        {currentResult.graphImages.map((graphImage: string, index: number) => (
                          <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <h5 className="text-sm font-medium text-slate-700 mb-2">
                              Graph {index + 1}
                              {currentResult.graphData && Array.isArray(currentResult.graphData) && currentResult.graphData[index] && 
                                ` - ${currentResult.graphData[index].title}`
                              }
                            </h5>
                            <div className="flex justify-center bg-white p-4 rounded border">
                              <img 
                                src={`data:image/png;base64,${graphImage}`}
                                alt={`Generated graph ${index + 1} for homework solution`}
                                className="max-w-full h-auto max-h-96 border border-slate-200 rounded shadow-sm"
                              />
                            </div>
                            {currentResult.graphData && Array.isArray(currentResult.graphData) && currentResult.graphData[index] && (
                              <div className="mt-3 text-sm text-slate-600">
                                <p><strong>Graph Type:</strong> {currentResult.graphData[index].type}</p>
                                <p><strong>Title:</strong> {currentResult.graphData[index].title}</p>
                                <p><strong>X-axis:</strong> {currentResult.graphData[index].xLabel}</p>
                                <p><strong>Y-axis:</strong> {currentResult.graphData[index].yLabel}</p>
                                {currentResult.graphData[index].description && 
                                  <p><strong>Description:</strong> {currentResult.graphData[index].description}</p>
                                }
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Legacy Single Graph Display */}
                    {currentResult.graphImage && !currentResult.graphImages && (
                      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <h4 className="text-md font-medium text-slate-900 mb-3 flex items-center">
                          📊 Generated Graph
                        </h4>
                        <div className="flex justify-center bg-white p-4 rounded border">
                          <img 
                            src={`data:image/png;base64,${currentResult.graphImage}`}
                            alt="Generated graph for homework solution"
                            className="max-w-full h-auto max-h-96 border border-slate-200 rounded shadow-sm"
                          />
                        </div>
                        {currentResult.graphData && (() => {
                          try {
                            const graphData = JSON.parse(currentResult.graphData);
                            return (
                              <div className="mt-3 text-sm text-slate-600">
                                <p><strong>Graph Type:</strong> {graphData.type}</p>
                                <p><strong>Title:</strong> {graphData.title}</p>
                                <p><strong>X-axis:</strong> {graphData.xLabel}</p>
                                <p><strong>Y-axis:</strong> {graphData.yLabel}</p>
                                {graphData.description && <p><strong>Description:</strong> {graphData.description}</p>}
                              </div>
                            );
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </div>
                    )}
                    
                    <div className="relative">
                      {/* FREEMIUM PREVIEW MODE */}
                      {currentResult.isPreview ? (
                        <div className="space-y-6">
                          {/* Preview Content */}
                          <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl">
                            <div className="mb-4 text-sm font-semibold text-yellow-800 uppercase tracking-wide flex items-center justify-between">
                              <span>👀 FREE PREVIEW - Get a taste of our AI solution</span>
                              {solutionAiScore !== null && (
                                <Badge variant="outline" className={getAIScoreColor(solutionAiScore)}>
                                  {getAIScoreText(solutionAiScore)}
                                </Badge>
                              )}
                            </div>
                            {isMathViewEnabled ? (
                              <MathRenderer 
                                content={currentResult.llmResponse}
                                className="space-y-4 math-content leading-relaxed"
                              />
                            ) : (
                              <pre className="whitespace-pre-wrap text-sm font-mono text-slate-800 leading-relaxed bg-white p-4 rounded-lg border border-yellow-200 overflow-x-auto">
                                {currentResult.llmResponse}
                              </pre>
                            )}
                          </div>
                          
                          {/* PAYPAL UPGRADE PROMPT */}
                          <div className="p-8 bg-gradient-to-br from-green-50 to-emerald-50 border-3 border-green-300 rounded-2xl shadow-lg">
                            <div className="text-center space-y-6">
                              <div className="text-3xl font-bold text-green-800">
                                🔓 Unlock Complete Solution
                              </div>
                              <div className="text-lg text-green-700 max-w-2xl mx-auto">
                                Want to see the <strong>full step-by-step solution</strong> with detailed explanations, graphs, and complete mathematical work? 
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                                <div className="bg-white p-4 rounded-lg border border-green-200">
                                  <div className="text-2xl mb-2">📚</div>
                                  <div className="font-semibold text-green-800">Complete Solutions</div>
                                  <div className="text-sm text-green-600">Full step-by-step explanations</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-green-200">
                                  <div className="text-2xl mb-2">📊</div>
                                  <div className="font-semibold text-green-800">Graphs & Charts</div>
                                  <div className="text-sm text-green-600">Auto-generated visualizations</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border border-green-200">
                                  <div className="text-2xl mb-2">💾</div>
                                  <div className="font-semibold text-green-800">PDF Export</div>
                                  <div className="text-sm text-green-600">Save & print your solutions</div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                <Button
                                  onClick={() => {
                                    // Check if user is authenticated, if not, show auth dialog first
                                    if (!user) {
                                      setShowAuthDialog(true);
                                    } else {
                                      // User is authenticated, show payment dialog
                                      setShowPaymentDialog(true);
                                    }
                                  }}
                                  className="px-8 py-4 text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
                                >
                                  💳 Buy Credits with PayPal
                                </Button>
                                
                                <div className="text-sm text-green-600 text-center">
                                  <div className="font-semibold">Starting at just $5</div>
                                  <div>Secure payment via PayPal</div>
                                </div>
                              </div>
                              
                              <div className="text-sm text-green-600 border-t border-green-200 pt-4">
                                ✨ <strong>Already have credits?</strong> {!user ? 'Login to access your account' : 'You need more credits to unlock this solution'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* FULL SOLUTION MODE - For paid users */
                        <>
                          {isMathViewEnabled ? (
                            <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                              <div className="mb-3 text-sm font-semibold text-blue-700 uppercase tracking-wide flex items-center justify-between">
                                <span>📐 Math View - Rendered Mathematical Notation</span>
                                {solutionAiScore !== null && (
                                  <Badge variant="outline" className={getAIScoreColor(solutionAiScore)}>
                                    {getAIScoreText(solutionAiScore)}
                                  </Badge>
                                )}
                              </div>
                              <MathRenderer 
                                content={currentResult.llmResponse}
                                className="space-y-4 math-content leading-relaxed"
                              />
                            </div>
                          ) : (
                            <div className="p-6 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl">
                              <div className="mb-3 text-sm font-semibold text-orange-700 uppercase tracking-wide flex items-center justify-between">
                                <span>📝 Edit View - Raw LaTeX Code</span>
                                {solutionAiScore !== null && (
                                  <Badge variant="outline" className={getAIScoreColor(solutionAiScore)}>
                                    {getAIScoreText(solutionAiScore)}
                                  </Badge>
                                )}
                              </div>
                              <pre className="whitespace-pre-wrap text-sm font-mono text-slate-800 leading-relaxed bg-white p-4 rounded-lg border border-orange-200 overflow-x-auto">
                                {currentResult.llmResponse}
                              </pre>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Word Count and AI Detection */}
                  {wordCount > 0 && (
                    <div className="flex items-center justify-between text-sm text-slate-600 bg-slate-50 p-3 rounded">
                      <span>Word count: {wordCount}</span>
                      <span>Generated by {getProviderDisplayName(selectedProvider)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>




          </Card>
        </div>



        {/* AI Chat Section */}
        <div className="mt-8">
          <Card className="flex flex-col shadow-lg border-slate-200">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <svg className="w-6 h-6 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.964L3 20l1.036-5.874A8.955 8.955 0 013 12a8 8 0 018-8c4.418 0 8 3.582 8 8z" />
                </svg>
                Chat with AI
              </h2>
              <p className="text-sm text-slate-700 mt-2 font-medium">Have detailed conversations about your homework, ask for explanations, or discuss mathematical concepts</p>
            </div>

            <div className="flex-1 p-8 min-h-[500px] flex flex-col bg-gradient-to-b from-white to-slate-50">
              <div className="flex-1 mb-6 p-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-y-auto max-h-96">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.964L3 20l1.036-5.874A8.955 8.955 0 013 12a8 8 0 018-8c4.418 0 8 3.582 8 8z" />
                      </svg>
                    </div>
                    <p className="text-sm">Start a conversation with {getProviderDisplayName(selectedProvider)}</p>
                    <p className="text-xs mt-1">Ask about the solution, request explanations, or chat about anything</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg ${
                          message.role === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-white border border-slate-200'
                        }`}>
                          {isMathViewEnabled ? (
                            <MathRenderer content={message.content} />
                          ) : (
                            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.content}
                            </pre>
                          )}
                          {message.role === 'assistant' && (
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendToInputBox(message.content)}
                                className="text-xs"
                              >
                                <ArrowDown className="w-3 h-3 mr-1" />
                                Send to Input
                              </Button>
                              {message.extractedText && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => sendToInputBox(message.extractedText)}
                                  className="text-xs"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  Send File Text
                                </Button>
                              )}
                            </div>
                          )}
                          <div className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                            {message.fileName && (
                              <span className="ml-2">📎 {message.fileName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isChatting && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-slate-200 p-3 rounded-lg">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                {chatFileUpload && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-blue-800 font-medium">{chatFileUpload.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setChatFileUpload(null)}
                      className="ml-auto h-8 w-8 p-0 hover:bg-blue-100"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 font-medium">💬 Write your message • Supports LaTeX math & file uploads</span>
                    <Button
                      onClick={() => {
                        setChatInput("");
                        setChatMessages([]);
                        setChatFileUpload(null);
                      }}
                      variant="ghost"
                      size="sm"
                      className="text-sm text-slate-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear Chat
                    </Button>
                  </div>
                  <div className="space-y-4 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                    <div className="relative">
                      <TextareaWithVoice
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="💬 Ask detailed questions, discuss the solution, request clarifications, or provide additional context...

Write your message here. This chat supports:
• LaTeX math notation (e.g., $x^2 + y^2 = z^2$, $$\int_{0}^{\infty} e^{-x} dx$$)
• Multi-line discussions and explanations
• File uploads for additional context and problems
• Rich mathematical conversations

Use Enter to send your message, or Shift+Enter for new lines."
                        className="min-h-[160px] resize-y text-base leading-relaxed p-6 border-2 border-slate-200 rounded-lg focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleChatMessage();
                          }
                        }}
                        disabled={isChatting}
                      />
                      {chatInput.length > 0 && (
                        <div className="absolute bottom-3 right-3 text-xs text-slate-400 bg-white px-2 py-1 rounded">
                          {chatInput.length} chars
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center space-x-4">
                        <FileUpload
                          onFileSelect={handleChatFileUpload}
                          isProcessing={isChatting}
                          accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                        />
                        <span className="text-sm text-slate-600 font-medium">
                          📎 Upload files • ⏎ Enter to send • ↵ Shift+Enter for new line
                        </span>
                      </div>
                      <Button 
                        onClick={handleChatMessage}
                        disabled={isChatting || (!chatInput.trim() && !chatFileUpload)}
                        className="px-8 py-3 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                        size="lg"
                      >
                        {isChatting ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5 mr-2" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Save Assignment Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Assignment Title</label>
              <InputWithVoice
                value={assignmentName}
                onChange={(e) => setAssignmentName(e.target.value)}
                placeholder="Enter a descriptive title for this assignment..."
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Question or Problem ({getWordCount(inputText)} words)</label>
                <div className="flex items-center space-x-2">
                  {inputText.trim() && (
                    <Button
                      onClick={() => analyzeInputAI(inputText)}
                      variant="outline"
                      size="sm"
                      disabled={isAnalyzingInput}
                      className="text-xs"
                      data-testid="button-analyze-input"
                    >
                      {isAnalyzingInput ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        "🤖"
                      )}
                      {isAnalyzingInput ? "Checking..." : "AI Check"}
                    </Button>
                  )}
                  {inputAiScore !== null && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${getAIScoreColor(inputAiScore)}`}
                      data-testid={`badge-input-ai-score-${inputAiScore}`}
                    >
                      {getAIScoreText(inputAiScore)}
                    </Badge>
                  )}
                </div>
              </div>
              <TextareaWithVoice
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or paste your homework question here..."
                className="min-h-[120px] resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Upload Document (Optional)</label>
              <FileUpload
                onFileSelect={(file) => {
                  // Handle file upload in the dialog
                  const formData = new FormData();
                  formData.append('file', file);
                  
                  fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                  })
                  .then(response => response.json())
                  .then(data => {
                    if (data.extractedText) {
                      setInputText(data.extractedText);
                      toast({
                        title: "File processed",
                        description: "Text extracted and added to the assignment",
                      });
                    }
                  })
                  .catch(error => {
                    toast({
                      title: "Upload failed",
                      description: "Could not process the file",
                      variant: "destructive",
                    });
                  });
                }}
                accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Special Instructions (Optional) ({getWordCount(specialInstructions)} words)</label>
              <TextareaWithVoice
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Add any special instructions for solving this problem..."
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSave} disabled={!assignmentName.trim()}>
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refine Solution Dialog */}
      <Dialog open={showRefineDialog} onOpenChange={setShowRefineDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Refine Solution</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Tell me what you like or dislike about the current solution. I'll improve it based on your feedback while keeping the good parts:
            </p>
            <MathTextarea
              value={refinementFeedback}
              onChange={(e) => setRefinementFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (refinementFeedback.trim() && !isRefining) {
                    handleRefineSolution();
                  }
                }
              }}
              placeholder="For example: 'Make it more detailed in section 2, simplify the explanation of X, add more examples for Y, change the tone to be more formal, etc.' (Ctrl/Cmd + Enter to submit)"
              className="min-h-[120px]"
              showClearButton={true}
              showVoiceButton={true}
              showMathPreview={false}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefineDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRefineSolution}
              disabled={!refinementFeedback.trim() || isRefining}
            >
              {isRefining && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Refine Solution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          // After successful auth, show payment dialog
          setTimeout(() => setShowPaymentDialog(true), 500);
        }}
      />

      {/* GPT BYPASS SECTION - ADDED BELOW HOMEWORK ASSISTANT */}
      <div className="mt-16 border-t-4 border-purple-600 pt-8">
        <GPTBypassSection 
          onSendToHomework={receiveFromGptBypass}
          receivedHomeworkText={gptBypassText}
        />
      </div>

    </div>
  );
}