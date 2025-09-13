import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import { processAssignmentSchema, emailSolutionSchema, registerSchema, loginSchema, purchaseCreditsSchema, tokenCheckSchema, type ProcessAssignmentRequest, type ProcessAssignmentResponse, type EmailSolutionRequest, type AssignmentListItem } from "@shared/schema";
import { ZodError } from "zod";
import Tesseract from "tesseract.js";
import pdf2json from "pdf2json";
import { execSync } from 'child_process';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { PDFDocument } from 'pdf-lib';
import { authService } from './auth';
import { countTokens, estimateOutputTokens, truncateResponse, TOKEN_LIMITS, generateSessionId, getTodayDate } from './tokenUtils';
import Stripe from 'stripe';
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "./paypal";
import './types';

// GPT BYPASS service imports
import { aiProviderService } from './services/aiProviders';
import { gptZeroService } from './services/gptZero';
import { fileProcessorService } from './services/fileProcessor';
import { textChunkerService } from './services/textChunker';

// LLM imports
// @ts-ignore
import Anthropic from "@anthropic-ai/sdk";
// @ts-ignore
import OpenAI from "openai";
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize LLM clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || "default_key",
});

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "default_key" 
});

// Azure OpenAI client
const azureOpenAI = process.env.AZURE_OPENAI_KEY && process.env.AZURE_OPENAI_ENDPOINT ? new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/gpt-4/`,
  defaultQuery: { 'api-version': '2024-02-15-preview' },
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_KEY,
  },
}) : null;

// DeepSeek client
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY || "default_key",
  baseURL: "https://api.deepseek.com/v1"
});

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key', {
  apiVersion: '2025-06-30.basil'
});

// DeepSeek processing function
function detectContentType(text: string): 'math' | 'document' | 'general' {
  // Writing/creative indicators (highest priority - should NOT get math treatment)
  const writingIndicators = [
    /write\s+(a\s+)?(short\s+)?(paper|essay|article|story|paragraph|report)/i,
    /rewrite\s+(as|in|into|to)/i,
    /convert\s+(to|into)\s+(dialogue|conversation|script)/i,
    /turn\s+(this|into)\s+(dialogue|conversation)/i,
    /make\s+(this|into)\s+(dialogue|conversation)/i,
    /write\s+(as|in)\s+(dialogue|conversation)/i,
    /dialogue\s+(format|form)/i,
    /format\s+(as|into)\s+(dialogue|conversation)/i,
    /compose\s+(a|an)/i,
    /draft\s+(a|an)/i,
    /create\s+(a|an)\s+(essay|paper|article|story)/i
  ];
  
  // Very specific mathematical problem indicators (much more restrictive)
  const mathIndicators = [
    /solve\s+(for\s+[xyz]|the\s+equation|this\s+equation)/i,
    /calculate\s+(the\s+(derivative|integral|limit|sum))/i,
    /find\s+(the\s+(derivative|integral|limit|solution|value\s+of\s+[xyz]))/i,
    /\b\d+[xyz]\s*[+\-*\/]\s*\d+[xyz]/,  // Mathematical expressions like 2x + 3y
    /[xyz]\s*=\s*[\d\-+*/^()xyz\s]+/,    // Equations like x = 2y + 3
    /differential\s+equation/i,
    /\bintegrate\s+[\w()^*+\-\/\s]*dx\b/i,
    /\bderivative\s+of\s+[\w()^*+\-\/\s]+/i,
    /solve\s+the\s+equation/i,
    /algebraic\s+equation/i,
    /quadratic\s+(equation|formula)/i
  ];
  
  // Document/text analysis indicators
  const docIndicators = [
    /summarize\s+(this|the)\s+(text|document|article|chapter|paper|passage)/i,
    /analyze\s+(this|the)\s+(text|document|article|chapter|paper|passage)/i,
    /summary\s+of\s+(this|the)\s+(text|document|article|chapter|paper|passage)/i,
    /analysis\s+of\s+(this|the)\s+(text|document|article|chapter|paper|passage)/i,
    /(given|following|attached)\s+(text|document|article|chapter|paper|passage)/i,
    /what\s+(does|is)\s+this\s+(text|document|article|chapter|paper|passage)/i,
    /the\s+author\s+(argues|states|claims|concludes)/i
  ];
  
  const writingScore = writingIndicators.filter(regex => regex.test(text)).length;
  const mathScore = mathIndicators.filter(regex => regex.test(text)).length;
  const docScore = docIndicators.filter(regex => regex.test(text)).length;
  
  // Prioritize writing requests (no math LaTeX treatment)
  if (writingScore > 0) return 'general';
  if (docScore > mathScore && docScore > 0) return 'document';
  if (mathScore > 0) return 'math';
  return 'general';
}

// Generate preview for freemium model
function generatePreview(fullResponse: string): string {
  // Remove any existing graph data JSON from the end
  const lines = fullResponse.split('\n');
  let contentLines = [...lines];
  
  // Remove graph data if present
  const graphStartIndex = contentLines.findIndex(line => 
    line.trim().startsWith('```json') || line.includes('GRAPH_DATA_START')
  );
  if (graphStartIndex !== -1) {
    contentLines = contentLines.slice(0, graphStartIndex);
  }
  
  const cleanResponse = contentLines.join('\n').trim();
  
  // Split into sentences for better preview control
  const sentences = cleanResponse.split(/(?<=[.!?])\s+/);
  
  // For math problems: Show problem setup + first step
  if (detectContentType(cleanResponse) === 'math') {
    // Find first few sentences that explain the approach
    let preview = '';
    let sentenceCount = 0;
    
    for (const sentence of sentences) {
      preview += sentence + ' ';
      sentenceCount++;
      
      // Stop after 2-3 sentences or when we hit the actual solution steps
      if (sentenceCount >= 2 || sentence.includes('Step 1') || sentence.includes('Solution:')) {
        break;
      }
    }
    
    return preview.trim() + '\n\n**🔒 Complete solution with all steps available with credits**\n\n[Buy Credits with PayPal to see the full step-by-step solution]';
  }
  
  // For documents: Show introduction + first main point
  else if (detectContentType(cleanResponse) === 'document') {
    const words = cleanResponse.split(/\s+/);
    const previewWords = words.slice(0, 150); // ~150 words preview
    
    return previewWords.join(' ') + '...\n\n**🔒 Complete analysis available with credits**\n\n[Buy Credits with PayPal to see the full detailed analysis]';
  }
  
  // For general questions: Show first paragraph
  else {
    const paragraphs = cleanResponse.split(/\n\s*\n/);
    const firstParagraph = paragraphs[0] || '';
    
    const words = firstParagraph.split(/\s+/);
    const previewWords = words.slice(0, 100); // ~100 words preview
    
    return previewWords.join(' ') + '...\n\n**🔒 Complete answer available with credits**\n\n[Buy Credits with PayPal to see the full detailed response]';
  }
}

// Direct DeepSeek processing without content detection (for refinements)
async function processDirectWithDeepSeek(prompt: string): Promise<{response: string, graphData?: GraphRequest[]}> {
  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key not configured');
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No response generated';

    return { response: content };
  } catch (error) {
    console.error('DeepSeek direct processing error:', error);
    throw new Error('Failed to process with DeepSeek');
  }
}

async function processWithDeepSeekFixed(text: string): Promise<{response: string, graphData?: GraphRequest[]}> {
  try {
    const contentType = detectContentType(text);
    const needsGraph = detectGraphRequirements(text);
    
    let prompt = '';
    
    if (contentType === 'document') {
      prompt = `You are an expert academic assistant specializing in document analysis and summarization.

CRITICAL FORMATTING REQUIREMENTS:
- NEVER write paragraphs longer than 4-5 sentences
- Use proper paragraph breaks with double line breaks
- Structure with clear headings and subheadings
- Use bullet points and numbered lists where appropriate
- Break up dense text into readable chunks
- Each paragraph should focus on ONE main idea

Your task is to provide a comprehensive, well-structured analysis of the given text. Follow these guidelines:

1. **Structure your response clearly** with proper headings and sections
2. **Break content into short, readable paragraphs** (maximum 4-5 sentences each)  
3. **Use headings, subheadings, bullet points, and lists** to organize information
4. **Provide substantive analysis** - don't just reformat the text
5. **Identify key concepts, arguments, and themes**
6. **Use proper academic writing style** with clear transitions
7. **Include specific examples and quotes** from the text when relevant
8. **Focus on meaning and significance** rather than just listing information

FORMAT REQUIREMENTS:
- Use # for main headings
- Use ## for subheadings  
- Use - for bullet points
- Use numbered lists for sequential information
- Separate paragraphs with double line breaks
- Keep paragraphs SHORT and focused

If this is a request for summary, provide:
- Main thesis or central argument
- Key supporting points
- Important concepts and terminology
- Logical flow of the argument
- Conclusions or implications

If this is a request for analysis, provide:
- Critical examination of arguments
- Strengths and weaknesses
- Connections to broader themes
- Your scholarly assessment

Text to analyze:`;
    } else if (contentType === 'math') {
      prompt = `CRITICAL: You MUST use perfect LaTeX mathematical notation for ALL mathematical content. This is non-negotiable.

Solve this homework assignment with these MANDATORY requirements:
1. ALL mathematical expressions MUST use proper LaTeX notation
2. Use $ for inline math: $x^2$, $\\frac{a}{b}$, $\\sin(x)$, $\\pi$, $\\alpha$
3. Use $$ for display equations: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
4. Include every mathematical step with perfect LaTeX formatting
5. Use correct LaTeX for: fractions $\\frac{a}{b}$, exponents $x^n$, roots $\\sqrt{x}$, integrals $\\int_a^b f(x)dx$, summations $\\sum_{i=1}^n$, limits $\\lim_{x \\to 0}$, derivatives $\\frac{d}{dx}$, partial derivatives $\\frac{\\partial}{\\partial x}$
6. Greek letters: $\\alpha$, $\\beta$, $\\gamma$, $\\delta$, $\\pi$, $\\theta$, $\\lambda$, $\\mu$, $\\sigma$
7. Functions: $\\sin(x)$, $\\cos(x)$, $\\tan(x)$, $\\log(x)$, $\\ln(x)$, $e^x$
8. Never use plain text for any mathematical symbol, number, or expression

Assignment to solve:`;
    } else {
      // General questions - NO mathematical notation forced
      prompt = `You are an expert academic assistant. Provide a clear, comprehensive answer to this question.

Instructions:
- Write in clear, engaging prose appropriate for the question
- Use proper paragraph structure with good flow
- Only use mathematical notation if the question specifically involves mathematical formulas
- For essay questions, philosophy, literature, or general topics, write in plain English
- Be thorough but concise
- Provide specific examples and explanations as needed

Question to answer:`;
    }

    if (needsGraph) {
      prompt += `

ADDITIONAL GRAPH REQUIREMENT:
This assignment may require one or more graphs/plots. After solving the problem, you MUST provide graph data for EACH required graph in this EXACT JSON format at the very end of your response:

For each graph needed:
GRAPH_DATA_START
{
  "type": "line|bar|scatter",
  "title": "Graph Title",
  "xLabel": "X-axis Label", 
  "yLabel": "Y-axis Label",
  "data": [
    {"x": value1, "y": value1},
    {"x": value2, "y": value2}
  ],
  "description": "Brief description of what the graph shows"
}
GRAPH_DATA_END

If multiple graphs are needed, provide multiple GRAPH_DATA_START...GRAPH_DATA_END blocks.
Generate realistic data points based on the scientific/mathematical principles in the assignment.`;
    }

    prompt += `\n\n${text}`;

    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ 
        role: "user", 
        content: prompt
      }],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content || 'No response generated';
    
    // Extract multiple graph data if present
    const graphData: GraphRequest[] = [];
    if (needsGraph && responseText.includes('GRAPH_DATA_START')) {
      try {
        const graphRegex = /GRAPH_DATA_START([\s\S]*?)GRAPH_DATA_END/g;
        let match;
        while ((match = graphRegex.exec(responseText)) !== null) {
          try {
            const graphJson = match[1].trim();
            const parsedGraph = JSON.parse(graphJson);
            graphData.push(parsedGraph);
          } catch (error) {
            console.error('Failed to parse individual graph data:', error);
          }
        }
      } catch (error) {
        console.error('Failed to parse graph data:', error);
      }
    }

    // Clean the response to remove graph data markers
    const cleanedResponse = responseText
      .replace(/GRAPH_DATA_START[\s\S]*?GRAPH_DATA_END/g, '')
      .trim();

    return { 
      response: cleanedResponse, 
      graphData: graphData.length > 0 ? graphData : undefined 
    };
  } catch (error) {
    console.error('DeepSeek API error:', error);
    throw new Error('Failed to process with DeepSeek');
  }
}

async function performMathpixOCR(buffer: Buffer): Promise<string> {
  if (!process.env.MATHPIX_APP_ID || !process.env.MATHPIX_APP_KEY) {
    throw new Error('Mathpix credentials not configured');
  }

  try {
    const base64Image = buffer.toString('base64');
    const response = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'app_id': process.env.MATHPIX_APP_ID,
        'app_key': process.env.MATHPIX_APP_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        src: `data:image/jpeg;base64,${base64Image}`,
        formats: ['text', 'latex_styled', 'latex_simplified', 'asciimath'],
        data_options: {
          include_asciimath: true,
          include_latex: true,
          include_mathml: true,
          include_word_data: false,
          include_line_data: false
        },
        format_options: {
          math_inline_delimiters: ['$', '$'],
          math_display_delimiters: ['$$', '$$'],
          rm_spaces: true,
          rm_fonts: false
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mathpix API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Prefer LaTeX styled format for perfect mathematical notation
    let extractedText = data.latex_styled || data.latex_simplified || data.text || '';
    
    // Log confidence if available
    if (data.confidence && data.confidence < 0.8) {
      console.warn('Low confidence Mathpix OCR result:', data.confidence);
    }
    
    // Enhance LaTeX formatting
    if (extractedText) {
      // Ensure proper LaTeX math delimiters
      extractedText = extractedText.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
      extractedText = extractedText.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
      
      // Clean up any double spaces
      extractedText = extractedText.replace(/\s+/g, ' ').trim();
    }
    
    return extractedText;
  } catch (error) {
    console.error('Mathpix OCR error:', error);
    throw error;
  }
}

async function performOCR(buffer: Buffer, fileName: string): Promise<string> {
  // Try Mathpix first for mathematical content
  if (process.env.MATHPIX_APP_ID && process.env.MATHPIX_APP_KEY) {
    try {
      const mathpixResult = await performMathpixOCR(buffer);
      if (mathpixResult && mathpixResult.trim().length > 0) {
        return mathpixResult;
      }
    } catch (error) {
      console.log('Mathpix failed, falling back to Tesseract');
    }
  }

  // Fallback to Tesseract
  try {
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: m => console.log(m)
    });
    return result.data.text;
  } catch (error) {
    console.error('OCR error:', error);
    throw new Error('Failed to extract text from image');
  }
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // Try multiple PDF extraction methods
  
  // Method 1: pdf2json
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const pdfParser = new pdf2json();
      
      const timeout = setTimeout(() => {
        reject(new Error('PDF parsing timeout'));
      }, 10000); // 10 second timeout
      
      pdfParser.on("pdfParser_dataError", (errData: any) => {
        clearTimeout(timeout);
        reject(new Error('PDF parsing failed'));
      });
      
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        clearTimeout(timeout);
        try {
          let text = '';
          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  if (textItem.R) {
                    for (const textRun of textItem.R) {
                      if (textRun.T) {
                        text += decodeURIComponent(textRun.T) + ' ';
                      }
                    }
                  }
                }
                text += '\n'; // Add line break between text blocks
              }
            }
          }
          resolve(text.trim());
        } catch (error) {
          reject(new Error('Failed to process PDF data'));
        }
      });
      
      pdfParser.parseBuffer(buffer);
    });
    
    if (result && result.trim().length > 10) {
      return result;
    }
  } catch (error) {
    console.log('pdf2json failed, trying alternative method');
  }
  
  // Method 2: Fallback to OCR using Tesseract on PDF pages
  try {
    console.log('Attempting OCR fallback for PDF');
    // Convert PDF to image and use OCR
    const text = await performOCR(buffer, 'document.pdf');
    if (text && text.trim().length > 10) {
      return text;
    }
  } catch (error) {
    console.log('OCR fallback also failed');
  }
  
  // If all methods fail, provide helpful error message
  throw new Error('Unable to extract text from this PDF. Please try: 1) Converting to Word document (.docx), 2) Taking screenshots and uploading as images (.png/.jpg), or 3) Copying and pasting the text directly.');
}

async function extractTextFromWord(buffer: Buffer): Promise<string> {
  try {
    // Use mammoth for .docx files
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Word document parsing error:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

// Helper function to clean HTML and formatting from text
function cleanResponse(text: string): string {
  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italic
    .replace(/#{1,6}\s*/g, '') // Headers
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Code blocks
    // Clean up multiple line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Graph generation functions
interface GraphRequest {
  type: string;
  title: string;
  xLabel: string;
  yLabel: string;
  data: Array<{x: number | string, y: number}>;
  description?: string;
}

function detectGraphRequirements(text: string): boolean {
  // Only generate graphs when explicitly requested with specific visual commands
  const explicitGraphKeywords = [
    'plot the', 'graph the', 'chart the', 'sketch the',
    'draw a graph', 'draw a plot', 'draw a chart',
    'create a graph', 'create a plot', 'create a chart',
    'show graphically', 'illustrate graphically',
    'sketch a graph', 'sketch a plot',
    'graph this', 'plot this',
    'draw the graph', 'draw the plot',
    'make a graph', 'make a plot',
    'construct a graph', 'construct a plot'
  ];
  
  const lowerText = text.toLowerCase();
  return explicitGraphKeywords.some(keyword => lowerText.includes(keyword));
}

// PDF combining function
async function combinePDFs(pdfBuffers: Buffer[]): Promise<Buffer> {
  const mergedPdf = await PDFDocument.create();
  
  for (const pdfBuffer of pdfBuffers) {
    const pdf = await PDFDocument.load(pdfBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  
  return Buffer.from(await mergedPdf.save());
}

async function generateGraph(graphData: GraphRequest): Promise<string> {
  const width = 800;
  const height = 600;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  // Determine chart type based on data and request
  let chartType: 'line' | 'bar' | 'scatter' = 'line';
  if (graphData.type.toLowerCase().includes('bar')) {
    chartType = 'bar';
  } else if (graphData.type.toLowerCase().includes('scatter')) {
    chartType = 'scatter';
  }

  let chartData: any;
  let chartLabels: any;

  if (chartType === 'scatter') {
    chartData = graphData.data.map(d => ({
      x: typeof d.x === 'string' ? parseFloat(d.x) || 0 : d.x,
      y: d.y
    }));
    chartLabels = undefined;
  } else {
    chartData = graphData.data.map(d => d.y);
    chartLabels = graphData.data.map(d => d.x);
  }

  const configuration: any = {
    type: chartType,
    data: {
      labels: chartLabels,
      datasets: [{
        label: graphData.title,
        data: chartData,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: chartType === 'bar' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: chartType === 'line',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: graphData.title,
          font: { size: 16, weight: 'bold' }
        },
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: graphData.xLabel,
            font: { size: 14, weight: 'bold' }
          },
          grid: { color: 'rgba(0,0,0,0.1)' }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: graphData.yLabel,
            font: { size: 14, weight: 'bold' }
          },
          grid: { color: 'rgba(0,0,0,0.1)' }
        }
      }
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return imageBuffer.toString('base64');
}

async function processWithAnthropicChat(message: string, conversationHistory: Array<{role: string, content: string}>, context?: any): Promise<{response: string, graphData?: GraphRequest[]}> {
  try {
    // Build conversation messages with proper typing
    const messages: Array<{role: 'user' | 'assistant', content: string}> = [];
    
    // Add context if available
    if (context) {
      messages.push({
        role: "user",
        content: `Context: I'm working on this problem: "${context.problem}" and got this solution: "${context.solution}"`
      });
    }
    
    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      messages: messages
    });

    const responseText = response.content[0]?.type === 'text' ? response.content[0].text : 'No response generated';
    return { response: responseText };
  } catch (error) {
    console.error('Anthropic chat error:', error);
    throw new Error('Failed to process chat with Anthropic');
  }
}

async function processWithAnthropic(text: string): Promise<{response: string, graphData?: GraphRequest[]}> {
  try {
    const contentType = detectContentType(text);
    const needsGraph = detectGraphRequirements(text);
    
    let prompt = '';
    
    if (contentType === 'document') {
      prompt = `You are an expert academic assistant specializing in document analysis and summarization.

CRITICAL FORMATTING REQUIREMENTS:
- NEVER write paragraphs longer than 4-5 sentences
- Use proper paragraph breaks with double line breaks
- Structure with clear headings and subheadings
- Use bullet points and numbered lists where appropriate
- Break up dense text into readable chunks
- Each paragraph should focus on ONE main idea

Your task is to provide a comprehensive, well-structured analysis of the given text. Follow these guidelines:

1. **Structure your response clearly** with proper headings and sections
2. **Break content into short, readable paragraphs** (maximum 4-5 sentences each)  
3. **Use headings, subheadings, bullet points, and lists** to organize information
4. **Provide substantive analysis** - don't just reformat the text
5. **Identify key concepts, arguments, and themes**
6. **Use proper academic writing style** with clear transitions
7. **Include specific examples and quotes** from the text when relevant
8. **Focus on meaning and significance** rather than just listing information

FORMAT REQUIREMENTS:
- Use # for main headings
- Use ## for subheadings  
- Use - for bullet points
- Use numbered lists for sequential information
- Separate paragraphs with double line breaks
- Keep paragraphs SHORT and focused

If this is a request for summary, provide:
- Main thesis or central argument
- Key supporting points
- Important concepts and terminology
- Logical flow of the argument
- Conclusions or implications

If this is a request for analysis, provide:
- Critical examination of arguments
- Strengths and weaknesses
- Connections to broader themes
- Your scholarly assessment

Text to analyze:`;
    } else if (contentType === 'math') {
      prompt = `CRITICAL: You MUST use perfect LaTeX mathematical notation for ALL mathematical content. This is non-negotiable.

Solve this homework assignment with these MANDATORY requirements:
1. ALL mathematical expressions MUST use proper LaTeX notation
2. Use $ for inline math: $x^2$, $\\frac{a}{b}$, $\\sin(x)$, $\\pi$, $\\alpha$
3. Use $$ for display equations: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
4. Include every mathematical step with perfect LaTeX formatting
5. Use correct LaTeX for: fractions $\\frac{a}{b}$, exponents $x^n$, roots $\\sqrt{x}$, integrals $\\int_a^b f(x)dx$, summations $\\sum_{i=1}^n$, limits $\\lim_{x \\to 0}$, derivatives $\\frac{d}{dx}$, partial derivatives $\\frac{\\partial}{\\partial x}$
6. Greek letters: $\\alpha$, $\\beta$, $\\gamma$, $\\delta$, $\\pi$, $\\theta$, $\\lambda$, $\\mu$, $\\sigma$
7. Functions: $\\sin(x)$, $\\cos(x)$, $\\tan(x)$, $\\log(x)$, $\\ln(x)$, $e^x$
8. Never use plain text for any mathematical symbol, number, or expression

Assignment to solve:`;
    } else {
      // General content - no forced LaTeX
      prompt = `You are a helpful academic assistant. Please provide a clear, well-structured response to the following request.

For writing tasks:
- Focus on clarity and good organization
- Use proper academic writing style
- Structure your response with appropriate headings if needed
- Write in a natural, engaging manner

For general questions:
- Provide comprehensive yet concise answers
- Use examples when helpful
- Organize information logically

Request:`;
    }

    if (needsGraph) {
      prompt += `

ADDITIONAL GRAPH REQUIREMENT:
This assignment may require one or more graphs/plots. After solving the problem, you MUST provide graph data for EACH required graph in this EXACT JSON format at the very end of your response:

For each graph needed:
GRAPH_DATA_START
{
  "type": "line|bar|scatter",
  "title": "Graph Title",
  "xLabel": "X-axis Label", 
  "yLabel": "Y-axis Label",
  "data": [
    {"x": value1, "y": value1},
    {"x": value2, "y": value2}
  ],
  "description": "Brief description of what the graph shows"
}
GRAPH_DATA_END

If multiple graphs are needed, provide multiple GRAPH_DATA_START...GRAPH_DATA_END blocks.
Generate realistic data points based on the scientific/mathematical principles in the assignment.`;
    }

    prompt += `\n\n${text}`;

    const message = await anthropic.messages.create({
      max_tokens: 4000,
      messages: [{ 
        role: 'user', 
        content: prompt
      }],
      model: 'claude-3-7-sonnet-20250219',
    });

    const response = message.content[0]?.type === 'text' ? message.content[0].text : 'No response generated';
    
    // Extract multiple graph data if present
    const graphData: GraphRequest[] = [];
    if (needsGraph && response.includes('GRAPH_DATA_START')) {
      try {
        const graphRegex = /GRAPH_DATA_START([\s\S]*?)GRAPH_DATA_END/g;
        let match;
        while ((match = graphRegex.exec(response)) !== null) {
          try {
            const graphJson = match[1].trim();
            const parsedGraph = JSON.parse(graphJson);
            graphData.push(parsedGraph);
          } catch (error) {
            console.error('Failed to parse individual graph data:', error);
          }
        }
      } catch (error) {
        console.error('Failed to parse graph data:', error);
      }
    }

    // Clean the response to remove graph data markers
    const cleanedResponse = response
      .replace(/GRAPH_DATA_START[\s\S]*?GRAPH_DATA_END/g, '')
      .trim();

    return { 
      response: cleanedResponse, 
      graphData: graphData.length > 0 ? graphData : undefined 
    };
  } catch (error) {
    console.error('Anthropic API error:', error);
    throw new Error('Failed to process with Anthropic');
  }
}

async function processWithOpenAIChat(message: string, conversationHistory: Array<{role: string, content: string}>, context?: any): Promise<{response: string, graphData?: GraphRequest[]}> {
  try {
    // Build conversation messages with proper typing
    const messages: Array<{role: 'user' | 'assistant' | 'system', content: string}> = [];
    
    // Add context if available
    if (context) {
      messages.push({
        role: "user",
        content: `Context: I'm working on this problem: "${context.problem}" and got this solution: "${context.solution}"`
      });
    }
    
    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      max_tokens: 4000,
    });

    const responseText = response.choices[0]?.message?.content || 'No response generated';
    return { response: responseText };
  } catch (error) {
    console.error('OpenAI chat error:', error);  
    throw new Error('Failed to process chat with OpenAI');
  }
}

async function processWithOpenAI(text: string): Promise<{response: string, graphData?: GraphRequest[]}> {
  try {
    const contentType = detectContentType(text);
    const needsGraph = detectGraphRequirements(text);
    
    let prompt = '';
    
    if (contentType === 'document') {
      prompt = `You are an expert academic assistant specializing in document analysis and summarization.

CRITICAL FORMATTING REQUIREMENTS:
- NEVER write paragraphs longer than 4-5 sentences
- Use proper paragraph breaks with double line breaks
- Structure with clear headings and subheadings
- Use bullet points and numbered lists where appropriate
- Break up dense text into readable chunks
- Each paragraph should focus on ONE main idea

Your task is to provide a comprehensive, well-structured analysis of the given text. Follow these guidelines:

1. **Structure your response clearly** with proper headings and sections
2. **Break content into short, readable paragraphs** (maximum 4-5 sentences each)  
3. **Use headings, subheadings, bullet points, and lists** to organize information
4. **Provide substantive analysis** - don't just reformat the text
5. **Identify key concepts, arguments, and themes**
6. **Use proper academic writing style** with clear transitions
7. **Include specific examples and quotes** from the text when relevant
8. **Focus on meaning and significance** rather than just listing information

Text to analyze:`;
    } else if (contentType === 'math') {
      prompt = `CRITICAL: You MUST use perfect LaTeX mathematical notation for ALL mathematical content. This is non-negotiable.

Solve this homework assignment with these MANDATORY requirements:
1. ALL mathematical expressions MUST use proper LaTeX notation
2. Use $ for inline math: $x^2$, $\\frac{a}{b}$, $\\sin(x)$, $\\pi$, $\\alpha$
3. Use $$ for display equations: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
4. Include every mathematical step with perfect LaTeX formatting
5. Use correct LaTeX for: fractions $\\frac{a}{b}$, exponents $x^n$, roots $\\sqrt{x}$, integrals $\\int_a^b f(x)dx$, summations $\\sum_{i=1}^n$, limits $\\lim_{x \\to 0}$, derivatives $\\frac{d}{dx}$, partial derivatives $\\frac{\\partial}{\\partial x}$
6. Greek letters: $\\alpha$, $\\beta$, $\\gamma$, $\\delta$, $\\pi$, $\\theta$, $\\lambda$, $\\mu$, $\\sigma$
7. Functions: $\\sin(x)$, $\\cos(x)$, $\\tan(x)$, $\\log(x)$, $\\ln(x)$, $e^x$
8. Never use plain text for any mathematical symbol, number, or expression

Assignment to solve:`;
    } else {
      // General content - no forced LaTeX
      prompt = `You are a helpful academic assistant. Please provide a clear, well-structured response to the following request.

For writing tasks:
- Focus on clarity and good organization
- Use proper academic writing style
- Structure your response with appropriate headings if needed
- Write in a natural, engaging manner

For general questions:
- Provide comprehensive yet concise answers
- Use examples when helpful
- Organize information logically

Request:`;
    }

    if (needsGraph) {
      prompt += `

ADDITIONAL GRAPH REQUIREMENT:
This assignment may require one or more graphs/plots. After solving the problem, you MUST provide graph data for EACH required graph in this EXACT JSON format at the very end of your response:

For each graph needed:
GRAPH_DATA_START
{
  "type": "line|bar|scatter",
  "title": "Graph Title",
  "xLabel": "X-axis Label", 
  "yLabel": "Y-axis Label",
  "data": [
    {"x": value1, "y": value1},
    {"x": value2, "y": value2}
  ],
  "description": "Brief description of what the graph shows"
}
GRAPH_DATA_END

If multiple graphs are needed, provide multiple GRAPH_DATA_START...GRAPH_DATA_END blocks.
Generate realistic data points based on the scientific/mathematical principles in the assignment.`;
    }

    prompt += `\n\nAssignment to solve:\n\n${text}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ 
        role: "user", 
        content: prompt
      }],
      max_tokens: 4000,
    });

    const responseText = response.choices[0]?.message?.content || 'No response generated';
    
    // Extract multiple graph data if present
    const graphData: GraphRequest[] = [];
    if (needsGraph && responseText.includes('GRAPH_DATA_START')) {
      try {
        const graphRegex = /GRAPH_DATA_START([\s\S]*?)GRAPH_DATA_END/g;
        let match;
        while ((match = graphRegex.exec(responseText)) !== null) {
          try {
            const graphJson = match[1].trim();
            const parsedGraph = JSON.parse(graphJson);
            graphData.push(parsedGraph);
          } catch (error) {
            console.error('Failed to parse individual graph data:', error);
          }
        }
      } catch (error) {
        console.error('Failed to parse graph data:', error);
      }
    }

    // Clean the response to remove graph data markers
    const cleanedResponse = responseText
      .replace(/GRAPH_DATA_START[\s\S]*?GRAPH_DATA_END/g, '')
      .trim();

    return { 
      response: cleanedResponse, 
      graphData: graphData.length > 0 ? graphData : undefined 
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to process with OpenAI');
  }
}

async function processWithAzureOpenAI(text: string): Promise<{response: string, graphData?: GraphRequest[]}> {
  if (!azureOpenAI) {
    throw new Error('Azure OpenAI not configured');
  }

  try {
    const contentType = detectContentType(text);
    const needsGraph = detectGraphRequirements(text);
    
    let prompt = '';
    
    if (contentType === 'document') {
      prompt = `You are an expert academic assistant specializing in document analysis and summarization.

CRITICAL FORMATTING REQUIREMENTS:
- NEVER write paragraphs longer than 4-5 sentences
- Use proper paragraph breaks with double line breaks
- Structure with clear headings and subheadings
- Use bullet points and numbered lists where appropriate
- Break up dense text into readable chunks
- Each paragraph should focus on ONE main idea

Text to analyze:`;
    } else if (contentType === 'math') {
      prompt = `CRITICAL: You MUST use perfect LaTeX mathematical notation for ALL mathematical content. This is non-negotiable.

Solve this homework assignment with these MANDATORY requirements:
1. ALL mathematical expressions MUST use proper LaTeX notation
2. Use $ for inline math: $x^2$, $\\frac{a}{b}$, $\\sin(x)$, $\\pi$, $\\alpha$
3. Use $$ for display equations: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
4. Include every mathematical step with perfect LaTeX formatting
5. Use correct LaTeX for: fractions $\\frac{a}{b}$, exponents $x^n$, roots $\\sqrt{x}$, integrals $\\int_a^b f(x)dx$, summations $\\sum_{i=1}^n$, limits $\\lim_{x \\to 0}$, derivatives $\\frac{d}{dx}$, partial derivatives $\\frac{\\partial}{\\partial x}$
6. Greek letters: $\\alpha$, $\\beta$, $\\gamma$, $\\delta$, $\\pi$, $\\theta$, $\\lambda$, $\\mu$, $\\sigma$
7. Functions: $\\sin(x)$, $\\cos(x)$, $\\tan(x)$, $\\log(x)$, $\\ln(x)$, $e^x$
8. Never use plain text for any mathematical symbol, number, or expression

Assignment to solve:`;
    } else {
      // General content - no forced LaTeX
      prompt = `You are a helpful academic assistant. Please provide a clear, well-structured response to the following request.

For writing tasks:
- Focus on clarity and good organization
- Use proper academic writing style
- Structure your response with appropriate headings if needed
- Write in a natural, engaging manner

For general questions:
- Provide comprehensive yet concise answers
- Use examples when helpful
- Organize information logically

Request:`;
    }

    if (needsGraph) {
      prompt += `

ADDITIONAL GRAPH REQUIREMENT:
This assignment may require one or more graphs/plots. After solving the problem, you MUST provide graph data for EACH required graph in this EXACT JSON format at the very end of your response:

For each graph needed:
GRAPH_DATA_START
{
  "type": "line|bar|scatter",
  "title": "Graph Title",
  "xLabel": "X-axis Label", 
  "yLabel": "Y-axis Label",
  "data": [
    {"x": value1, "y": value1},
    {"x": value2, "y": value2}
  ],
  "description": "Brief description of what the graph shows"
}
GRAPH_DATA_END

If multiple graphs are needed, provide multiple GRAPH_DATA_START...GRAPH_DATA_END blocks.
Generate realistic data points based on the scientific/mathematical principles in the assignment.`;
    }

    prompt += `\n\nAssignment to solve:\n\n${text}`;

    const response = await azureOpenAI.chat.completions.create({
      model: "gpt-4",
      messages: [{ 
        role: "user", 
        content: prompt
      }],
      max_tokens: 4000,
    });

    const responseText = response.choices[0]?.message?.content || 'No response generated';
    
    // Extract multiple graph data if present
    const graphData: GraphRequest[] = [];
    if (needsGraph && responseText.includes('GRAPH_DATA_START')) {
      try {
        const graphRegex = /GRAPH_DATA_START([\s\S]*?)GRAPH_DATA_END/g;
        let match;
        while ((match = graphRegex.exec(responseText)) !== null) {
          try {
            const graphJson = match[1].trim();
            const parsedGraph = JSON.parse(graphJson);
            graphData.push(parsedGraph);
          } catch (error) {
            console.error('Failed to parse individual graph data:', error);
          }
        }
      } catch (error) {
        console.error('Failed to parse graph data:', error);
      }
    }

    // Clean the response to remove graph data markers
    const cleanedResponse = responseText
      .replace(/GRAPH_DATA_START[\s\S]*?GRAPH_DATA_END/g, '')
      .trim();

    return { 
      response: cleanedResponse, 
      graphData: graphData.length > 0 ? graphData : undefined 
    };
  } catch (error) {
    console.error('Azure OpenAI API error:', error);
    throw new Error('Failed to process with Azure OpenAI');
  }
}

async function processWithPerplexityChat(message: string, conversationHistory: Array<{role: string, content: string}>, context?: any): Promise<{response: string, graphData?: GraphRequest[]}> {
  try {
    // Build conversation messages
    const messages = [];
    
    // Add context if available
    if (context) {
      messages.push({
        role: "user",
        content: `Context: I'm working on this problem: "${context.problem}" and got this solution: "${context.solution}"`
      });
    }
    
    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY || process.env.VITE_PERPLEXITY_API_KEY || "default_key"}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: messages,
        max_tokens: 4000,
        temperature: 0.1,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0]?.message?.content || 'No response generated';
    return { response: responseText };
  } catch (error) {
    console.error('Perplexity chat error:', error);
    throw new Error('Failed to process chat with Perplexity');
  }
}

async function processWithPerplexity(text: string): Promise<{response: string, graphData?: GraphRequest[]}> {
  try {
    const contentType = detectContentType(text);
    const needsGraph = detectGraphRequirements(text);
    
    let prompt = '';
    
    if (contentType === 'document') {
      prompt = `You are an expert academic assistant specializing in document analysis and summarization.

CRITICAL FORMATTING REQUIREMENTS:
- NEVER write paragraphs longer than 4-5 sentences
- Use proper paragraph breaks with double line breaks
- Structure with clear headings and subheadings
- Use bullet points and numbered lists where appropriate
- Break up dense text into readable chunks
- Each paragraph should focus on ONE main idea

Your task is to provide a comprehensive, well-structured analysis of the given text.

Text to analyze:`;
    } else if (contentType === 'math') {
      prompt = `CRITICAL: You MUST use perfect LaTeX mathematical notation for ALL mathematical content. This is non-negotiable.

Solve this homework assignment with these MANDATORY requirements:
1. ALL mathematical expressions MUST use proper LaTeX notation
2. Use $ for inline math: $x^2$, $\\frac{a}{b}$, $\\sin(x)$, $\\pi$, $\\alpha$
3. Use $$ for display equations: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
4. Include every mathematical step with perfect LaTeX formatting
5. Use correct LaTeX for: fractions $\\frac{a}{b}$, exponents $x^n$, roots $\\sqrt{x}$, integrals $\\int_a^b f(x)dx$, summations $\\sum_{i=1}^n$, limits $\\lim_{x \\to 0}$, derivatives $\\frac{d}{dx}$, partial derivatives $\\frac{\\partial}{\\partial x}$
6. Greek letters: $\\alpha$, $\\beta$, $\\gamma$, $\\delta$, $\\pi$, $\\theta$, $\\lambda$, $\\mu$, $\\sigma$
7. Functions: $\\sin(x)$, $\\cos(x)$, $\\tan(x)$, $\\log(x)$, $\\ln(x)$, $e^x$
8. Never use plain text for any mathematical symbol, number, or expression

Assignment to solve:`;
    } else {
      // General content - no forced LaTeX
      prompt = `You are a helpful academic assistant. Please provide a clear, well-structured response to the following request.

For writing tasks:
- Focus on clarity and good organization
- Use proper academic writing style
- Structure your response with appropriate headings if needed
- Write in a natural, engaging manner

For general questions:
- Provide comprehensive yet concise answers
- Use examples when helpful
- Organize information logically

Request:`;
    }

    if (needsGraph) {
      prompt += `

ADDITIONAL GRAPH REQUIREMENT:
This assignment may require one or more graphs/plots. After solving the problem, you MUST provide graph data for EACH required graph in this EXACT JSON format at the very end of your response:

For each graph needed:
GRAPH_DATA_START
{
  "type": "line|bar|scatter",
  "title": "Graph Title",
  "xLabel": "X-axis Label", 
  "yLabel": "Y-axis Label",
  "data": [
    {"x": value1, "y": value1},
    {"x": value2, "y": value2}
  ],
  "description": "Brief description of what the graph shows"
}
GRAPH_DATA_END

If multiple graphs are needed, provide multiple GRAPH_DATA_START...GRAPH_DATA_END blocks.
Generate realistic data points based on the scientific/mathematical principles in the assignment.`;
    }

    prompt += `\n\nAssignment to solve:\n\n${text}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY || process.env.VITE_PERPLEXITY_API_KEY || "default_key"}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0]?.message?.content || 'No response generated';
    
    // Extract multiple graph data if present
    const graphData: GraphRequest[] = [];
    if (needsGraph && responseText.includes('GRAPH_DATA_START')) {
      try {
        const graphRegex = /GRAPH_DATA_START([\s\S]*?)GRAPH_DATA_END/g;
        let match;
        while ((match = graphRegex.exec(responseText)) !== null) {
          try {
            const graphJson = match[1].trim();
            const parsedGraph = JSON.parse(graphJson);
            graphData.push(parsedGraph);
          } catch (error) {
            console.error('Failed to parse individual graph data:', error);
          }
        }
      } catch (error) {
        console.error('Failed to parse graph data:', error);
      }
    }

    // Clean the response to remove graph data markers
    const cleanedResponse = responseText
      .replace(/GRAPH_DATA_START[\s\S]*?GRAPH_DATA_END/g, '')
      .trim();

    return { 
      response: cleanedResponse, 
      graphData: graphData.length > 0 ? graphData : undefined 
    };
  } catch (error) {
    console.error('Perplexity API error:', error);
    throw new Error('Failed to process with Perplexity');
  }
}

async function searchWithGoogle(query: string): Promise<string> {
  if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CSE_ID) {
    return '';
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_API_KEY}&cx=${process.env.GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=3`
    );

    if (!response.ok) {
      throw new Error(`Google CSE API error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.items?.slice(0, 3) || [];
    
    return results.map((item: any) => 
      `**${item.title}**\n${item.snippet}\nSource: ${item.link}`
    ).join('\n\n');
  } catch (error) {
    console.error('Google Search error:', error);
    return '';
  }
}

async function checkAIDetection(text: string): Promise<any> {
  if (!process.env.GPTZERO_API_KEY) {
    return { probability: 0, message: 'AI detection not configured' };
  }

  const response = await fetch('https://api.gptzero.me/v2/predict/text', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GPTZERO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document: text
    }),
  });

  if (!response.ok) {
    throw new Error(`GPTZero API error: ${response.statusText}`);
  }

  return await response.json();
}

// HTML to PDF conversion using Puppeteer
async function convertHtmlToPdf(htmlContent: string, title: string = 'Assignment Solution', graphImage?: string): Promise<Buffer> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--font-render-hinting=none'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set content with enhanced HTML structure and perfect math rendering
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <script>
        window.MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
                processEscapes: true,
                processEnvironments: true,
                packages: {'[+]': ['ams', 'newcommand', 'mathtools', 'physics']}
            },
            chtml: {
                scale: 1.2,
                minScale: 0.8,
                matchFontHeight: false,
                fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
            },
            loader: {
                load: ['[tex]/ams', '[tex]/newcommand', '[tex]/mathtools', '[tex]/physics']
            },
            startup: {
                ready: () => {
                    MathJax.startup.defaultReady();
                    window.mathJaxReady = true;
                }
            }
        };
    </script>
    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <style>
        body {
            font-family: 'Computer Modern', 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.8;
            color: #000;
            margin: 40px;
            background: white;
            max-width: none;
        }
        h1, h2, h3 {
            color: #000;
            margin-bottom: 20px;
            font-weight: bold;
            page-break-after: avoid;
        }
        h1 { font-size: 18pt; }
        h2 { font-size: 16pt; }
        h3 { font-size: 14pt; }
        .solution-content {
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 12pt;
            line-height: 1.8;
        }
        .mjx-chtml {
            font-size: 120% !important;
            line-height: 1.8 !important;
        }
        .MJXc-display {
            margin: 1em 0 !important;
        }
        p {
            margin-bottom: 12pt;
            text-align: justify;
        }
        @page {
            margin: 1in;
            size: letter;
        }
        .graph-image {
            max-width: 100%;
            height: auto;
            margin: 20px 0;
            display: block;
            border: 1px solid #ddd;
            border-radius: 4px;
            page-break-inside: avoid;
        }
        @media print {
            body { 
                margin: 0; 
                font-size: 12pt;
            }
            .mjx-chtml {
                font-size: 120% !important;
            }
            .graph-image {
                max-width: 100%;
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${graphImage ? `<img src="data:image/png;base64,${graphImage}" alt="Generated Graph" class="graph-image" />` : ''}
    <div class="solution-content">${htmlContent}</div>
    <script>
        // Wait for MathJax to finish rendering
        if (window.MathJax) {
            window.MathJax.startup.promise.then(() => {
                window.mathJaxReady = true;
            });
        } else {
            window.mathJaxReady = true;
        }
    </script>
</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    // Wait for MathJax to fully load and render all mathematics
    await page.waitForFunction(() => {
      return window.MathJax && window.MathJax.typesetPromise !== undefined;
    }, { timeout: 15000 });
    
    // Force MathJax to render all math elements
    await page.evaluate(() => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        return window.MathJax.typesetPromise();
      }
    });
    
    // Additional wait to ensure complete rendering
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate PDF with high quality settings
    const pdfBuffer = await page.pdf({
      format: 'letter',
      margin: {
        top: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
        right: '0.75in'
      },
      printBackground: true,
      preferCSSPageSize: true
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('HTML to PDF conversion error:', error);
    throw new Error('Failed to convert HTML to PDF');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// PDF Generation function using LaTeX/Tectonic
// Enhanced Math PDF generation with pre-rendered HTML support
async function generateMathPDF(content: string, title: string = 'Assignment Solution', extractedText?: string): Promise<Buffer> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--font-render-hinting=none'
      ]
    });
    
    const page = await browser.newPage();
    
    // Enhanced HTML structure for perfect math rendering
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
    <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
        processEscapes: true,
        processEnvironments: true
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
      },
      startup: {
        ready: () => {
          console.log('MathJax is loaded, but not yet initialized');
          MathJax.startup.defaultReady();
          console.log('MathJax is initialized, and the initial typeset is queued');
        }
      }
    };
    </script>
    <script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <style>
        body {
            font-family: 'Computer Modern', 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.8;
            color: #000;
            margin: 40px;
            background: white;
            max-width: none;
        }
        h1, h2, h3 {
            color: #000;
            margin-bottom: 20px;
            font-weight: bold;
            page-break-after: avoid;
        }
        h1 { font-size: 18pt; text-align: center; }
        h2 { font-size: 16pt; }
        h3 { font-size: 14pt; }
        .problem-section {
            background: #f9f9f9;
            padding: 15px;
            border-left: 4px solid #3b82f6;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .solution-content {
            font-size: 12pt;
            line-height: 1.8;
        }
        /* Preserve all math rendering from client */
        mjx-container, .mjx-chtml, .MathJax {
            display: inline-block !important;
            font-size: 120% !important;
            line-height: 1.8 !important;
            margin: 0.1em !important;
            color: #000 !important;
        }
        mjx-container[display="true"] {
            display: block !important;
            text-align: center !important;
            margin: 1em 0 !important;
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
                color: #000 !important;
            }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    
    ${extractedText ? `
    <div class="problem-section">
        <h2>Problem Statement</h2>
        <p>${extractedText.replace(/\n/g, '<br>')}</p>
    </div>
    ` : ''}
    
    <div class="solution-section">
        <h2>Solution</h2>
        <div class="solution-content">${content}</div>
    </div>
</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    // Wait for MathJax to load and render all math
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
          window.MathJax.startup.promise.then(() => {
            if (window.MathJax.typesetPromise) {
              window.MathJax.typesetPromise.then(resolve);
            } else {
              resolve();
            }
          });
        } else {
          // Fallback timeout if MathJax doesn't load
          setTimeout(resolve, 3000);
        }
      });
    });
    
    // Additional wait to ensure complete rendering
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate PDF with high quality settings
    const pdfBuffer = await page.pdf({
      format: 'letter',
      margin: {
        top: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
        right: '0.75in'
      },
      printBackground: true,
      preferCSSPageSize: true
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('Math PDF generation error:', error);
    throw new Error('Failed to generate math PDF');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generatePDF(content: string, title: string = 'Assignment Solution', extractedText?: string, graphImage?: string): Promise<Buffer> {
  const tempId = randomBytes(16).toString('hex');
  const tempDir = path.join('/tmp', `latex_${tempId}`);
  const texFile = path.join(tempDir, 'document.tex');
  const pdfFile = path.join(tempDir, 'document.pdf');

  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // Escape LaTeX special characters in content
    const escapedContent = content
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/%/g, '\\%')
      .replace(/&/g, '\\&')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/_/g, '\\_')
      .replace(/\^/g, '\\textasciicircum{}')
      .replace(/~/g, '\\textasciitilde{}');

    const escapedExtractedText = extractedText ? extractedText
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/\$/g, '\\$')
      .replace(/#/g, '\\#')
      .replace(/%/g, '\\%')
      .replace(/&/g, '\\&')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/_/g, '\\_')
      .replace(/\^/g, '\\textasciicircum{}')
      .replace(/~/g, '\\textasciitilde{}') : '';

    // Create LaTeX document
    const latexContent = `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{geometry}
\\usepackage{fancyhdr}

\\geometry{letterpaper, margin=1in}
\\pagestyle{fancy}
\\fancyhf{}
\\rhead{${new Date().toLocaleDateString()}}
\\lhead{Assignment Solution}
\\cfoot{\\thepage}

\\title{${title}}
\\author{AI-Generated Solution}
\\date{${new Date().toLocaleDateString()}}

\\begin{document}

\\maketitle

${extractedText ? `
\\section{Problem Statement}
\\begin{quote}
${escapedExtractedText}
\\end{quote}

` : ''}
\\section{Solution}

${escapedContent}

\\end{document}`;

    // Write LaTeX file
    fs.writeFileSync(texFile, latexContent, 'utf8');

    // Compile with tectonic
    execSync(`cd ${tempDir} && tectonic document.tex`, {
      stdio: 'pipe',
      timeout: 30000
    });

    // Read the generated PDF
    const pdfBuffer = fs.readFileSync(pdfFile);

    return pdfBuffer;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Failed to generate PDF');
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
}



export async function registerRoutes(app: Express): Promise<Server> {
  
  // Initialize session middleware
  const PgSession = ConnectPgSimple(session);
  
  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'homework-pro-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Allow HTTP in development and deployment
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

  // Auth routes
  app.post('/api/register', async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      // SPECIAL CASE: jmkuczynski gets unlimited access
      if (userData.username === 'jmkuczynski') {
        let user = await storage.getUserByUsername('jmkuczynski');
        if (!user) {
          user = await storage.createUser({
            username: 'jmkuczynski',
            password: 'dummy', // Password doesn't matter for this user
            tokenBalance: 99999999 // Unlimited tokens
          });
        }
        
        // Store user in session
        req.session.userId = user.id;
        
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            tokenBalance: 99999999
          }
        });
        return;
      }
      
      const user = await authService.register(userData);
      
      // Store user in session
      req.session.userId = user.id;
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          tokenBalance: user.tokenBalance || 0
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Registration failed' 
      });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      // Special handling for jmkuczynski and randyjohnson - allow login without password
      let loginData;
      const username = req.body.username?.toLowerCase()?.trim();
      
      if (username === 'jmkuczynski' || username === 'randyjohnson') {
        loginData = { username: req.body.username, password: undefined };
      } else {
        loginData = loginSchema.parse(req.body);
      }
      
      // SPECIAL CASE: jmkuczynski and randyjohnson get unlimited access with NO PASSWORD required
      const loginUsername = loginData.username?.toLowerCase()?.trim();
      if (loginUsername === 'jmkuczynski' || loginUsername === 'randyjohnson') {
        // No password validation needed for special users
        // Create or update user with unlimited tokens
        let user = await storage.getUserByUsername(loginData.username);
        if (!user) {
          // Create with dummy hashed password - just use a simple hash
          const hashedPassword = `dummy_hash_for_${loginData.username}`;
          user = await storage.createUser({
            username: loginData.username,
            password: hashedPassword,
            tokenBalance: 99999999 // Unlimited tokens
          });
        } else {
          // Ensure unlimited tokens
          await storage.updateUserTokenBalance(user.id, 99999999);
          user.tokenBalance = 99999999;
        }
        
        // Store user in session
        req.session.userId = user.id;
        
        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            tokenBalance: 99999999
          }
        });
        return;
      }
      
      // Validate password is provided for users who aren't special accounts
      if (!loginData.password) {
        return res.status(400).json({ error: 'Password required' });
      }
      
      const user = await authService.login(loginData);
      
      // Store user in session
      req.session.userId = user.id;
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          tokenBalance: user.tokenBalance
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Login failed' 
      });
    }
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/me', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const user = await authService.getUserById(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // SPECIAL CASE: jmkuczynski and randyjohnson always show unlimited tokens
      const tokenBalance = (user.username === 'jmkuczynski' || user.username === 'randyjohnson') ? 99999999 : (user.tokenBalance || 0);
      
      res.json({
        id: user.id,
        username: user.username,
        tokenBalance: tokenBalance
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  // Token check endpoint
  app.post('/api/check-tokens', async (req, res) => {
    try {
      const { inputText, sessionId } = tokenCheckSchema.parse(req.body);
      
      const inputTokens = countTokens(inputText);
      const estimatedOutputTokens = estimateOutputTokens(inputText);
      const totalTokens = inputTokens + estimatedOutputTokens;
      
      // Check if user is authenticated
      if (req.session.userId) {
        const user = await authService.getUserById(req.session.userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        // SPECIAL CASE: jmkuczynski and randyjohnson have unlimited access
        if (user.username === 'jmkuczynski' || user.username === 'randyjohnson') {
          res.json({
            canProcess: true,
            inputTokens,
            estimatedOutputTokens,
            remainingBalance: 99999999,
            message: undefined
          });
          return;
        }
        
        const canProcess = (user.tokenBalance || 0) >= totalTokens;
        
        res.json({
          canProcess,
          inputTokens,
          estimatedOutputTokens,
          remainingBalance: user.tokenBalance || 0,
          message: canProcess ? undefined : '🔒 You\'ve used all your credits. [Buy More Credits]'
        });
      } else {
        // Free user logic
        const today = getTodayDate();
        const dailyUsage = await storage.getDailyUsage(sessionId || generateSessionId(), today);
        const currentDailyUsage = dailyUsage?.totalTokens || 0;
        
        let canProcess = true;
        let message: string | undefined;
        
        // Check input token limit
        if (inputTokens > TOKEN_LIMITS.FREE_INPUT_LIMIT) {
          canProcess = false;
          message = '🔒 Full results available with upgrade. [Register & Unlock Full Access]';
        }
        // Check output token limit
        else if (estimatedOutputTokens > TOKEN_LIMITS.FREE_OUTPUT_LIMIT) {
          canProcess = false;
          message = '🔒 Full results available with upgrade. [Register & Unlock Full Access]';
        }
        // Check daily limit
        else if (currentDailyUsage + totalTokens > TOKEN_LIMITS.FREE_DAILY_LIMIT) {
          canProcess = false;
          message = '🔒 You\'ve reached the free usage limit for today. [Register & Unlock Full Access]';
        }
        
        res.json({
          canProcess,
          inputTokens,
          estimatedOutputTokens,
          dailyUsage: currentDailyUsage,
          dailyLimit: TOKEN_LIMITS.FREE_DAILY_LIMIT,
          message
        });
      }
    } catch (error) {
      console.error('Token check error:', error);
      res.status(500).json({ error: 'Failed to check tokens' });
    }
  });

  // Stripe payment endpoints
  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const { amount } = purchaseCreditsSchema.parse(req.body);
      const tokens = TOKEN_LIMITS.CREDIT_TIERS[amount];
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${tokens.toLocaleString()} Homework Pro Tokens`,
                description: 'Credits for AI-powered homework assistance',
              },
              unit_amount: parseInt(amount) * 100, // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/?payment=success`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/?payment=cancelled`,
        client_reference_id: req.session.userId.toString(),
        metadata: {
          userId: req.session.userId.toString(),
          tokens: tokens.toString()
        }
      });
      
      res.json({ sessionId: session.id });
    } catch (error) {
      console.error('Stripe session creation error:', error);
      res.status(500).json({ error: 'Failed to create payment session' });
    }
  });

  app.post('/api/webhook/stripe', async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test'
      );
      
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const userId = parseInt(session.metadata.userId);
        const tokens = parseInt(session.metadata.tokens);
        
        // Update user's token balance
        const user = await authService.getUserById(userId);
        if (user) {
          await storage.updateUserTokenBalance(userId, user.tokenBalance + tokens);
        }
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook error:', error);
      res.status(400).json({ error: 'Webhook failed' });
    }
  });

  // PayPal payment endpoints
  app.get("/api/paypal/setup", async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  app.post("/api/paypal/order", async (req, res) => {
    // Request body should contain: { intent, amount, currency }
    await createPaypalOrder(req, res);
  });

  app.post("/api/paypal/order/:orderID/capture", async (req, res) => {
    try {
      // Capture the PayPal payment
      await capturePaypalOrder(req, res);
      
      // TODO: Add token balance update logic here after successful capture
      // This would involve:
      // 1. Getting order details to determine token amount
      // 2. Getting user from session 
      // 3. Adding tokens to user account
      
    } catch (error) {
      console.error('PayPal capture error:', error);
      res.status(500).json({ error: 'Failed to capture payment' });
    }
  });

  // Azure Speech configuration endpoint
  app.get('/api/azure-speech-config', (req, res) => {
    const endpoint = process.env.AZURE_SPEECH_ENDPOINT;
    const subscriptionKey = process.env.AZURE_SPEECH_KEY;
    
    if (!subscriptionKey) {
      return res.status(500).json({ error: 'Azure Speech key not configured' });
    }
    
    // Extract region from endpoint URL if available, otherwise default to eastus
    let region = 'eastus';
    if (endpoint) {
      const match = endpoint.match(/https:\/\/([^.]+)\.cognitiveservices\.azure\.com/);
      if (match) {
        region = match[1];
      }
    }
    
    res.json({ subscriptionKey, region });
  });

  // Refine solution endpoint
  app.post('/api/refine-solution', async (req, res) => {
    try {
      const { originalProblem, currentSolution, feedback, provider } = req.body;
      
      if (!originalProblem || !currentSolution || !feedback || !provider) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const startTime = Date.now();
      
      // Detect content type to determine appropriate formatting
      const contentType = detectContentType(originalProblem);
      
      let refinementPrompt = `You are an expert academic assistant. The user wants you to improve their existing solution based on feedback.

ORIGINAL PROBLEM:
${originalProblem}

CURRENT SOLUTION:
${currentSolution}

USER FEEDBACK:
${feedback}

IMPORTANT: You must respond with ONLY the improved solution. Do NOT provide analysis, commentary, or explanations about what you changed. Simply provide the refined solution text directly.

Requirements:
- Keep good parts that weren't criticized
- Address all feedback points`;

      if (contentType === 'math') {
        refinementPrompt += `
- Use proper LaTeX notation ($ for inline, $$ for display math)`;
      } else {
        refinementPrompt += `
- Write in clear, natural language appropriate for the question
- Only use mathematical notation if the problem specifically requires it`;
      }

      refinementPrompt += `
- Maintain logical flow and structure

Respond with the refined solution only:`;

      let refinedResult: {response: string, graphData?: GraphRequest[]};
      
      try {
        switch (provider) {
          case 'deepseek':
            // Don't run content detection again - use the already-prepared prompt directly
            refinedResult = await processDirectWithDeepSeek(refinementPrompt);
            break;
          case 'anthropic':
            refinedResult = await processWithAnthropic(refinementPrompt);
            break;
          case 'openai':
            refinedResult = await processWithOpenAI(refinementPrompt);
            break;
          case 'azure':
            refinedResult = await processWithAzureOpenAI(refinementPrompt);
            break;
          case 'perplexity':
            refinedResult = await processWithPerplexity(refinementPrompt);
            break;
          default:
            throw new Error('Invalid provider');
        }
      } catch (error) {
        console.error(`Error with ${provider}:`, error);
        throw error;
      }

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        refinedSolution: cleanResponse(refinedResult.response),
        processingTime,
        provider
      });

    } catch (error) {
      console.error('Refine solution error:', error);
      res.status(500).json({ 
        error: 'Failed to refine solution',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  // File upload endpoint
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { llmProvider } = req.body;
      if (!llmProvider || !['anthropic', 'openai', 'perplexity', 'azure', 'deepseek'].includes(llmProvider)) {
        return res.status(400).json({ error: "Invalid LLM provider" });
      }

      const startTime = Date.now();
      
      // Extract text from uploaded file
      let extractedText = '';
      const fileName = req.file.originalname;
      const fileType = req.file.mimetype;

      if (fileType.startsWith('image/')) {
        extractedText = await performOCR(req.file.buffer, fileName);
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                 fileType === 'application/msword' ||
                 fileName.toLowerCase().endsWith('.docx') ||
                 fileName.toLowerCase().endsWith('.doc')) {
        extractedText = await extractTextFromWord(req.file.buffer);
      } else if (fileType === 'application/pdf') {
        extractedText = await extractTextFromPDF(req.file.buffer);
      } else {
        return res.status(400).json({ error: "File type not supported yet. Please use images or Word documents." });
      }

      if (!extractedText.trim()) {
        return res.status(400).json({ error: "No text could be extracted from the file" });
      }

      // Process with selected LLM
      let llmResult: {response: string, graphData?: GraphRequest[]};
      switch (llmProvider) {
        case 'anthropic':
          llmResult = await processWithAnthropic(extractedText);
          break;
        case 'openai':
          llmResult = await processWithOpenAI(extractedText);
          break;
        case 'azure':
          llmResult = await processWithAzureOpenAI(extractedText);
          break;
        case 'perplexity':
          llmResult = await processWithPerplexity(extractedText);
          break;
        case 'deepseek':
          llmResult = await processWithDeepSeekFixed(extractedText);
          break;
        default:
          throw new Error(`Unsupported LLM provider: ${llmProvider}`);
      }

      const processingTime = Date.now() - startTime;

      // Generate graphs if required
      let graphImages: string[] | undefined;
      let graphDataJsons: string[] | undefined;
      
      if (llmResult.graphData && llmResult.graphData.length > 0) {
        try {
          graphImages = [];
          graphDataJsons = [];
          
          for (const graphData of llmResult.graphData) {
            const graphImage = await generateGraph(graphData);
            graphImages.push(graphImage);
            graphDataJsons.push(JSON.stringify(graphData));
          }
        } catch (error) {
          console.error('Graph generation error:', error);
          // Continue without graphs if generation fails
        }
      }

      // Don't auto-save assignment

      const response: ProcessAssignmentResponse = {
        id: Date.now(), // Generate a temporary ID for the response
        extractedText,
        llmResponse: llmResult.response,
        graphData: graphDataJsons,
        graphImages: graphImages,
        processingTime,
        success: true,
      };

      res.json(response);
    } catch (error) {
      console.error('Upload processing error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process upload" 
      });
    }
  });

  // Save assignment endpoint
  app.post("/api/save-assignment", async (req, res) => {
    try {
      const { inputText, title, specialInstructions } = req.body;
      
      if (!inputText) {
        return res.status(400).json({ error: "Input text is required" });
      }

      const assignment = await storage.createAssignment({
        inputText,
        inputType: 'text',
        fileName: title || null,
        extractedText: null,
        llmProvider: 'saved',
        llmResponse: '',
        processingTime: 0,
      });

      res.json({ 
        success: true, 
        id: assignment.id,
        message: "Assignment saved successfully"
      });
    } catch (error) {
      console.error('Save assignment error:', error);
      res.status(500).json({ error: "Failed to save assignment" });
    }
  });

  // Text processing endpoint with token management
  app.post("/api/process-text", async (req, res) => {
    try {
      const { inputText, llmProvider, sessionId } = processAssignmentSchema.parse(req.body);

      if (!inputText) {
        return res.status(400).json({ error: "Input text is required" });
      }

      const startTime = Date.now();
      
      // Count tokens
      const inputTokens = countTokens(inputText);
      const estimatedOutputTokens = estimateOutputTokens(inputText);
      const totalTokens = inputTokens + estimatedOutputTokens;
      
      let actualSessionId = sessionId;
      let userId = req.session.userId;
      
      // Check token limits and process accordingly
      if (userId) {
        // Registered user - check token balance
        const user = await authService.getUserById(userId);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        
        // SPECIAL CASE: jmkuczynski and randyjohnson have unlimited access
        if (user.username !== 'jmkuczynski' && user.username !== 'randyjohnson' && (user.tokenBalance || 0) < totalTokens) {
          return res.status(402).json({ 
            error: "🔒 You've used all your credits. [Buy More Credits]",
            needsUpgrade: true 
          });
        }
        
        // Process with full response
        let llmResult: {response: string, graphData?: GraphRequest[]};
        switch (llmProvider) {
          case 'anthropic':
            llmResult = await processWithAnthropic(inputText);
            break;
          case 'openai':
            llmResult = await processWithOpenAI(inputText);
            break;
          case 'azure':
            llmResult = await processWithAzureOpenAI(inputText);
            break;
          case 'perplexity':
            llmResult = await processWithPerplexity(inputText);
            break;
          case 'deepseek':
            llmResult = await processWithDeepSeekFixed(inputText);
            break;
          default:
            throw new Error(`Unsupported LLM provider: ${llmProvider}`);
        }

        const actualOutputTokens = countTokens(llmResult.response);
        const actualTotalTokens = inputTokens + actualOutputTokens;
        
        // SPECIAL CASE: Don't deduct tokens from jmkuczynski or randyjohnson
        if (user.username !== 'jmkuczynski' && user.username !== 'randyjohnson') {
          // Deduct tokens
          await storage.updateUserTokenBalance(userId, (user.tokenBalance || 0) - actualTotalTokens);
          
          // Log token usage
          await storage.createTokenUsage({
            userId,
            sessionId: null,
            inputTokens,
            outputTokens: actualOutputTokens,
            remainingBalance: (user.tokenBalance || 0) - actualTotalTokens
          });
        }
        
        const processingTime = Date.now() - startTime;

        // Generate graphs if required
        let graphImages: string[] | undefined;
        let graphDataJsons: string[] | undefined;
        
        if (llmResult.graphData && llmResult.graphData.length > 0) {
          try {
            graphImages = [];
            graphDataJsons = [];
            
            for (const graphData of llmResult.graphData) {
              const graphImage = await generateGraph(graphData);
              graphImages.push(graphImage);
              graphDataJsons.push(JSON.stringify(graphData));
            }
          } catch (error) {
            console.error('Graph generation error:', error);
          }
        }

        // Store assignment
        const assignment = await storage.createAssignment({
          userId,
          sessionId: null,
          inputText,
          inputType: 'text',
          fileName: null,
          extractedText: null,
          llmProvider,
          llmResponse: llmResult.response,
          graphData: graphDataJsons,
          graphImages: graphImages,
          processingTime,
          inputTokens,
          outputTokens: actualOutputTokens,
        });

        const response: ProcessAssignmentResponse = {
          id: assignment.id,
          extractedText: inputText,
          llmResponse: llmResult.response,
          graphData: graphDataJsons,
          graphImages: graphImages,
          processingTime,
          success: true,
        };

        res.json(response);
      } else {
        // Free user - FREEMIUM MODEL: Process full answer but show only preview
        if (!actualSessionId) {
          actualSessionId = generateSessionId();
        }
        
        // Process with LLM to get complete answer
        let llmResult: {response: string, graphData?: GraphRequest[]};
        switch (llmProvider) {
          case 'anthropic':
            llmResult = await processWithAnthropic(inputText);
            break;
          case 'openai':
            llmResult = await processWithOpenAI(inputText);
            break;
          case 'azure':
            llmResult = await processWithAzureOpenAI(inputText);
            break;
          case 'perplexity':
            llmResult = await processWithPerplexity(inputText);
            break;
          case 'deepseek':
            llmResult = await processWithDeepSeekFixed(inputText);
            break;
          default:
            throw new Error(`Unsupported LLM provider: ${llmProvider}`);
        }

        // Generate preview for free users
        const previewResponse = generatePreview(llmResult.response);
        const finalOutputTokens = countTokens(previewResponse);
        const finalTotalTokens = inputTokens + finalOutputTokens;
        
        const processingTime = Date.now() - startTime;

        // No graphs for free users - premium feature
        const graphImages: string[] | undefined = undefined;
        const graphDataJsons: string[] | undefined = undefined;

        // Store assignment with preview only
        const assignment = await storage.createAssignment({
          userId: null,
          sessionId: actualSessionId,
          inputText,
          inputType: 'text',
          fileName: null,
          extractedText: null,
          llmProvider,
          llmResponse: previewResponse, // Store preview, not full answer
          graphData: graphDataJsons,
          graphImages: graphImages,
          processingTime,
          inputTokens,
          outputTokens: finalOutputTokens,
        });

        const response: ProcessAssignmentResponse = {
          id: assignment.id,
          extractedText: inputText,
          llmResponse: previewResponse, // Return preview to frontend
          graphData: graphDataJsons,
          graphImages: graphImages,
          processingTime,
          success: true,
          isPreview: true, // Flag to indicate this is a preview
        };

        res.json(response);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      
      console.error('Text processing error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process text" 
      });
    }
  });

  // Get all assignments with user isolation
  app.get("/api/assignments", async (req, res) => {
    try {
      // SECURITY: Get user ID from session for isolation
      const userId = req.session.userId;
      
      // Get assignments scoped to user (or anonymous if no user)
      const assignments = await storage.getAllAssignments(userId);
      const assignmentList: AssignmentListItem[] = assignments.map(assignment => ({
        id: assignment.id,
        extractedText: assignment.extractedText,
        llmProvider: assignment.llmProvider,
        processingTime: assignment.processingTime || 0,
        createdAt: assignment.createdAt?.toISOString() || new Date().toISOString(),
        fileName: assignment.fileName,
      }));
      
      res.json(assignmentList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  // Get assignment by ID with user isolation
  app.get("/api/assignments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // SECURITY: Get user ID from session for isolation
      const userId = req.session.userId;
      
      const assignment = await storage.getAssignment(id, userId);
      
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignment" });
    }
  });

  // Delete assignment by ID with user isolation
  app.delete("/api/assignments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // SECURITY: Get user ID from session for isolation
      const userId = req.session.userId;
      
      await storage.deleteAssignment(id, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });

  // Clean up assignments without file names
  app.post("/api/assignments/cleanup", async (req, res) => {
    try {
      await storage.cleanupEmptyAssignments();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to cleanup assignments" });
    }
  });

  // Extract text from file endpoint (no LLM processing)
  app.post("/api/extract-text", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      let extractedText = "";
      const fileName = file.originalname.toLowerCase();
      
      if (fileName.endsWith('.pdf')) {
        extractedText = await extractTextFromPDF(file.buffer);
      } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        extractedText = await extractTextFromWord(file.buffer);
      } else if (fileName.match(/\.(png|jpg|jpeg)$/)) {
        extractedText = await performOCR(file.buffer, fileName);
      } else {
        return res.status(400).json({ error: "Unsupported file type. Please upload PDF, Word document, or image file." });
      }

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(400).json({ error: "No text could be extracted from the file" });
      }

      res.json({ 
        extractedText: extractedText.trim(),
        fileName: file.originalname 
      });
    } catch (error: any) {
      console.error('Text extraction error:', error);
      res.status(500).json({ error: error.message || 'Failed to extract text from file' });
    }
  });

  // Email solution endpoint
  app.post("/api/email-solution", async (req, res) => {
    try {
      const { toEmail, fromEmail, content, title } = req.body;

      if (!toEmail || !fromEmail || !content) {
        return res.status(400).json({ error: "To email, from email, and content are required" });
      }

      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ error: "SendGrid not configured. Please provide SENDGRID_API_KEY." });
      }

      const { default: sgMail } = await import('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title || 'Homework Solution'}</title>
          <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
          <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
          <script>
            window.MathJax = {
              tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEscapes: true
              }
            };
          </script>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1, h2 { color: #2563eb; }
            .solution-section { margin-top: 20px; }
            .math-content { white-space: pre-wrap; word-wrap: break-word; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>${title || 'Homework Solution'}</h1>
          
          <div class="solution-section">
            <div class="math-content">${content}</div>
          </div>
          
          <div class="footer">
            <p>This solution was generated by the AI Homework Assistant.</p>
          </div>
        </body>
        </html>
      `;

      const msg = {
        to: toEmail,
        from: process.env.SENDGRID_VERIFIED_SENDER || fromEmail,
        subject: title || 'Your Homework Solution',
        html: htmlContent,
      };

      await sgMail.send(msg);
      
      res.json({ success: true, message: 'Solution sent successfully!' });
    } catch (error: any) {
      console.error('Email sending error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to send email" 
      });
    }
  });

  // AI detection endpoint
  app.post("/api/ai-detection", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }

      const result = await checkAIDetection(text);
      res.json(result);
    } catch (error: any) {
      console.error('AI detection error:', error);
      res.status(500).json({ error: error.message || 'AI detection failed' });
    }
  });

  // HTML to PDF conversion endpoint
  app.post("/api/html-to-pdf", async (req, res) => {
    try {
      const { htmlContent, title, graphImage } = req.body;
      
      if (!htmlContent || typeof htmlContent !== 'string') {
        return res.status(400).json({ error: "HTML content is required" });
      }

      const pdfBuffer = await convertHtmlToPdf(htmlContent, title, graphImage);
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${title || 'assignment'}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('HTML to PDF conversion error:', error);
      res.status(500).json({ error: error.message || 'Failed to convert HTML to PDF' });
    }
  });

  // PDF generation endpoint (LaTeX fallback)
  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { content, title, extractedText, graphImage } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      const pdfBuffer = await generatePDF(content, title, extractedText, graphImage);
      
      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${title || 'assignment'}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate PDF' });
    }
  });

  // Graph PDF generation endpoint
  app.post("/api/generate-graph-pdf", async (req, res) => {
    try {
      const { graphImage, title } = req.body;
      
      if (!graphImage || typeof graphImage !== 'string') {
        return res.status(400).json({ error: "Graph image is required" });
      }

      const graphHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title || 'Generated Graph'}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            margin: 0;
            padding: 40px;
            background: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        h1 {
            color: #000;
            margin-bottom: 30px;
            font-size: 24pt;
            text-align: center;
        }
        .graph-container {
            width: 100%;
            display: flex;
            justify-content: center;
            margin-bottom: 20px;
        }
        .graph-image {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        @page {
            margin: 0.75in;
            size: letter;
        }
        @media print {
            body { margin: 0; }
        }
    </style>
</head>
<body>
    <h1>${title || 'Generated Graph'}</h1>
    <div class="graph-container">
        <img src="data:image/png;base64,${graphImage}" alt="Generated Graph" class="graph-image" />
    </div>
</body>
</html>`;

      const pdfBuffer = await convertHtmlToPdf(graphHtml, title || 'Generated Graph');
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${(title || 'graph').replace(/[^a-zA-Z0-9]/g, '_')}_graph.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Graph PDF generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate graph PDF' });
    }
  });

  // Email solution endpoint using SendGrid
  app.post("/api/email-solution", async (req, res) => {
    try {
      const { email, solution, assignmentTitle } = req.body;
      
      if (!email || !solution) {
        return res.status(400).json({ error: "Email and solution are required" });
      }

      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ error: "SendGrid API key not configured" });
      }

      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to: email,
        from: process.env.SENDGRID_VERIFIED_SENDER || 'noreply@example.com',
        subject: assignmentTitle || 'Homework Solution',
        text: solution,
        html: `<pre>${solution}</pre>`
      };

      await sgMail.send(msg);
      
      res.json({ 
        success: true, 
        message: "Email sent successfully" 
      });
    } catch (error: any) {
      console.error('SendGrid email error:', error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, provider, context, conversationHistory = [] } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      // Build conversation context
      let fullPrompt = message;
      
      if (context) {
        fullPrompt = `Context: I'm working on this problem: "${context.problem}" and got this solution: "${context.solution}"\n\n`;
      }
      
      if (conversationHistory.length > 0) {
        const historyText = conversationHistory
          .map((msg: any) => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        fullPrompt = `Previous conversation:\n${historyText}\n\nCurrent question: ${message}`;
      }

      let result: {response: string, graphData?: any};
      switch (provider) {
        case 'anthropic':
          result = await processWithAnthropic(fullPrompt);
          break;
        case 'openai':
          result = await processWithOpenAI(fullPrompt);
          break;
        case 'perplexity':
          result = await processWithPerplexity(fullPrompt);
          break;
        case 'deepseek':
          result = await processWithDeepSeekFixed(fullPrompt);
          break;
        default:
          return res.status(400).json({ error: "Invalid provider" });
      }

      res.json({ response: result.response });
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({ error: error.message || 'Chat failed' });
    }
  });

  // Enhanced Math PDF generation endpoint
  app.post("/api/generate-math-pdf", async (req, res) => {
    try {
      const { content, title, extractedText, renderedHtml } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      // Use pre-rendered HTML if available, otherwise process math content
      const mathContent = renderedHtml || content;
      
      const pdfBuffer = await generateMathPDF(mathContent, title, extractedText);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${(title || 'math-solution').replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Math PDF generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate math PDF' });
    }
  });

  // Chat file upload endpoint
  app.post("/api/chat-upload", upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      const { provider, message, conversationHistory = [] } = req.body;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      let extractedText = "";
      const fileName = file.originalname.toLowerCase();
      
      if (fileName.endsWith('.pdf')) {
        extractedText = await extractTextFromPDF(file.buffer);
      } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        extractedText = await extractTextFromWord(file.buffer);
      } else if (fileName.match(/\.(png|jpg|jpeg)$/)) {
        extractedText = await performOCR(file.buffer, fileName);
      } else {
        return res.status(400).json({ error: "Unsupported file type. Please upload PDF, Word document, or image file." });
      }

      let chatPrompt = message ? `${message}\n\nFile content:\n${extractedText}` : `Please analyze this file content:\n\n${extractedText}`;
      
      // Add conversation history context
      if (conversationHistory && conversationHistory.length > 0) {
        const historyText = conversationHistory
          .map((msg: any) => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        chatPrompt = `Previous conversation:\n${historyText}\n\n${chatPrompt}`;
      }

      let result: {response: string, graphData?: any};
      switch (provider) {
        case 'anthropic':
          result = await processWithAnthropic(chatPrompt);
          break;
        case 'openai':
          result = await processWithOpenAI(chatPrompt);
          break;
        case 'perplexity':
          result = await processWithPerplexity(chatPrompt);
          break;
        default:
          return res.status(400).json({ error: "Invalid provider" });
      }

      res.json({ response: result.response, extractedText, fileName: file.originalname });
    } catch (error: any) {
      console.error('Chat upload error:', error);
      res.status(500).json({ error: error.message || 'Chat upload failed' });
    }
  });

  // Rewrite endpoint
  app.post("/api/rewrite", async (req, res) => {
    try {
      const { originalSolution, critique, provider, problem } = req.body;
      
      if (!originalSolution || !critique || !provider) {
        return res.status(400).json({ error: "Original solution, critique, and provider are required" });
      }

      const rewritePrompt = `I need you to rewrite this solution based on the critique provided.

Original Problem: ${problem}

Original Solution:
${originalSolution}

Critique/Feedback:
${critique}

Please provide an improved solution that addresses the feedback. Maintain proper mathematical notation and formatting.`;

      let result: {response: string, graphData?: GraphRequest[]};
      switch (provider) {
        case 'anthropic':
          result = await processWithAnthropic(rewritePrompt);
          break;
        case 'openai':
          result = await processWithOpenAI(rewritePrompt);
          break;
        case 'perplexity':
          result = await processWithPerplexity(rewritePrompt);
          break;
        default:
          return res.status(400).json({ error: "Invalid provider" });
      }

      res.json({ rewrittenSolution: result.response });
    } catch (error: any) {
      console.error('Rewrite error:', error);
      res.status(500).json({ error: error.message || 'Rewrite failed' });
    }
  });

  // Multi-graph PDF generation endpoint
  app.post("/api/generate-multi-graph-pdf", async (req, res) => {
    try {
      const { graphImages, graphData, title } = req.body;
      
      if (!graphImages || !Array.isArray(graphImages) || graphImages.length === 0) {
        return res.status(400).json({ error: "Graph images are required" });
      }

      const pdfBuffers: Buffer[] = [];
      
      // Generate individual graph PDFs
      for (let i = 0; i < graphImages.length; i++) {
        const graphImage = graphImages[i];
        const graphInfo = graphData && graphData[i] ? JSON.parse(graphData[i]) : {};
        const graphTitle = graphInfo.title || `Graph ${i + 1}`;
        
        const graphHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${graphTitle}</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .graph-container {
            text-align: center;
            max-width: 100%;
        }
        .graph-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #333;
        }
        .graph-image {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .graph-description {
            margin-top: 20px;
            font-size: 14px;
            color: #666;
            max-width: 600px;
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="graph-container">
        <h1 class="graph-title">${graphTitle}</h1>
        <img src="data:image/png;base64,${graphImage}" alt="${graphTitle}" class="graph-image" />
        ${graphInfo.description ? `<p class="graph-description">${graphInfo.description}</p>` : ''}
    </div>
</body>
</html>`;

        const graphPdfBuffer = await convertHtmlToPdf(graphHtml, graphTitle);
        pdfBuffers.push(graphPdfBuffer);
      }

      // Combine all PDFs
      const combinedPdf = await combinePDFs(pdfBuffers);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${title || 'graphs'}_combined.pdf"`);
      res.setHeader('Content-Length', combinedPdf.length);
      
      res.send(combinedPdf);
    } catch (error: any) {
      console.error('Multi-graph PDF generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate multi-graph PDF' });
    }
  });

  // Combined solution + graphs PDF endpoint
  app.post("/api/generate-combined-pdf", async (req, res) => {
    try {
      const { content, title, extractedText, graphImages, graphData } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      const pdfBuffers: Buffer[] = [];

      // Generate individual graph PDFs first
      if (graphImages && Array.isArray(graphImages) && graphImages.length > 0) {
        for (let i = 0; i < graphImages.length; i++) {
          const graphImage = graphImages[i];
          const graphInfo = graphData && graphData[i] ? JSON.parse(graphData[i]) : {};
          const graphTitle = graphInfo.title || `Graph ${i + 1}`;
          
          const graphHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${graphTitle}</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .graph-container {
            text-align: center;
            max-width: 100%;
        }
        .graph-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #333;
        }
        .graph-image {
            max-width: 100%;
            height: auto;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .graph-description {
            margin-top: 20px;
            font-size: 14px;
            color: #666;
            max-width: 600px;
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="graph-container">
        <h1 class="graph-title">${graphTitle}</h1>
        <img src="data:image/png;base64,${graphImage}" alt="${graphTitle}" class="graph-image" />
        ${graphInfo.description ? `<p class="graph-description">${graphInfo.description}</p>` : ''}
    </div>
</body>
</html>`;

          const graphPdfBuffer = await convertHtmlToPdf(graphHtml, graphTitle);
          pdfBuffers.push(graphPdfBuffer);
        }
      }

      // Generate main solution PDF
      let solutionHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title || 'Assignment Solution'}</title>
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
            color: #333;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }
        .problem-section {
            background: #f9f9f9;
            padding: 15px;
            border-left: 4px solid #3b82f6;
            margin-bottom: 20px;
        }
        .solution-section {
            margin-top: 20px;
        }
        @media print {
            body { margin: 0; }
            .problem-section { 
                background: #f5f5f5 !important; 
                -webkit-print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <h1>${(title || 'Assignment Solution').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
    
    ${extractedText ? `
    <div class="problem-section">
        <h2>Problem Statement</h2>
        <p>${extractedText.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    </div>
    ` : ''}
    
    <div class="solution-section">
        <h2>Solution</h2>
        <div class="math-content">${content}</div>
    </div>
</body>
</html>`;

      const solutionPdfBuffer = await convertHtmlToPdf(solutionHtml, title || 'Assignment Solution');
      pdfBuffers.push(solutionPdfBuffer);

      // Combine all PDFs
      const combinedPdf = await combinePDFs(pdfBuffers);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${title || 'assignment'}_complete.pdf"`);
      res.setHeader('Content-Length', combinedPdf.length);
      
      res.send(combinedPdf);
    } catch (error: any) {
      console.error('Combined PDF generation error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate combined PDF' });
    }
  });

  // GPT BYPASS / Humanizer routes
  app.post('/api/humanize/rewrite', async (req, res) => {
    try {
      const { inputText, styleText, contentMixText, customInstructions, selectedPresets, provider, selectedChunkIds, mixingMode } = req.body;

      if (!inputText || !provider) {
        return res.status(400).json({ error: 'Input text and provider are required' });
      }

      // Get initial AI score
      const initialScore = await gptZeroService.analyzeText(inputText);
      
      // Create chunks if needed
      const chunks = selectedChunkIds && selectedChunkIds.length > 0 ? 
        textChunkerService.chunkText(inputText) : [{ id: 'full', content: inputText, startWord: 0, endWord: inputText.split(' ').length }];
      
      // Reconstruct text from selected chunks or use full text
      const textToRewrite = selectedChunkIds && selectedChunkIds.length > 0 ?
        chunks.filter(chunk => selectedChunkIds.includes(chunk.id)).map(chunk => chunk.content).join(' ') : inputText;
      
      // Rewrite text using AI provider service
      const rewrittenText = await aiProviderService.rewrite(provider, {
        inputText: textToRewrite,
        styleText,
        contentMixText,
        customInstructions,
        selectedPresets,
        mixingMode
      });
      
      // Get final AI score
      const finalScore = await gptZeroService.analyzeText(rewrittenText);
      
      // Store in database
      const jobId = `rewrite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await storage.createRewriteJob({
        id: jobId,
        inputText,
        styleText,
        contentMixText,
        customInstructions,
        selectedPresets,
        provider,
        chunks: JSON.stringify(chunks),
        selectedChunkIds: JSON.stringify(selectedChunkIds || []),
        mixingMode,
        outputText: rewrittenText,
        inputAiScore: initialScore.aiScore,
        outputAiScore: finalScore.aiScore,
        status: 'completed'
      });
      
      res.json({
        rewrittenText,
        inputAiScore: initialScore.aiScore,
        outputAiScore: finalScore.aiScore,
        jobId
      });
    } catch (error) {
      console.error('Rewrite error:', error);
      res.status(500).json({ error: error.message || 'Failed to rewrite text' });
    }
  });

  app.post('/api/humanize/analyze', async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const result = await gptZeroService.analyzeText(text);
      
      res.json(result);
    } catch (error) {
      console.error('Analysis error:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze text' });
    }
  });

  app.post('/api/humanize/chunk', async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const chunks = textChunkerService.chunkText(text);
      const stats = textChunkerService.getChunkStats(chunks);
      
      res.json({ chunks, stats });
    } catch (error) {
      console.error('Chunking error:', error);
      res.status(500).json({ error: error.message || 'Failed to chunk text' });
    }
  });

  app.post('/api/humanize/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!fileProcessorService.isValidFileType(req.file.originalname)) {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      if (req.file.size > fileProcessorService.getMaxFileSize()) {
        return res.status(400).json({ error: 'File too large' });
      }

      const processedFile = await fileProcessorService.processFile(req.file.buffer, req.file.originalname);
      
      // Store document in database
      await storage.createDocument({
        id: processedFile.id,
        filename: processedFile.filename,
        content: processedFile.content,
        wordCount: processedFile.wordCount
      });
      
      res.json(processedFile);
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to process file' });
    }
  });

  app.get('/api/humanize/jobs/:id', async (req, res) => {
    try {
      const job = await storage.getRewriteJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      res.json(job);
    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ error: error.message || 'Failed to get job' });
    }
  });

  app.get('/api/humanize/jobs', async (req, res) => {
    try {
      const jobs = await storage.getRewriteJobs();
      res.json(jobs);
    } catch (error) {
      console.error('Get jobs error:', error);
      res.status(500).json({ error: error.message || 'Failed to get jobs' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
