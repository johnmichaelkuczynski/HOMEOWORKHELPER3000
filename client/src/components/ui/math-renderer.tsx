import { useEffect, useRef } from 'react';

interface MathRendererProps {
  content: string;
  className?: string;
}

export function MathRenderer({ content, className = "" }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && content) {
      // Enhanced formatting processing
      let processedContent = content
        // Handle headings
        .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
        .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
        
        // Handle numbered lists
        .replace(/^\d+\.\s+(.*$)/gm, '<li class="ml-4 mb-2">$1</li>')
        
        // Handle bullet points
        .replace(/^[-*]\s+(.*$)/gm, '<li class="ml-4 mb-2">$1</li>')
        
        // Handle bold and italic
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        
        // Handle code blocks
        .replace(/```(.*?)```/gs, '<pre class="bg-gray-100 p-3 rounded-md my-3 overflow-x-auto"><code>$1</code></pre>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
        
        // Handle line breaks and paragraphs
        .replace(/\n\n/g, '</p><p class="mb-4">')
        .replace(/\n/g, '<br/>');

      // Wrap consecutive list items in ul tags
      processedContent = processedContent.replace(/(<li class="ml-4 mb-2">.*?<\/li>)(\s*<li class="ml-4 mb-2">.*?<\/li>)*/g, (match) => {
        return '<ul class="list-disc list-inside mb-4">' + match + '</ul>';
      });

      // Wrap in paragraphs if not already wrapped
      if (!processedContent.startsWith('<p>') && !processedContent.startsWith('<h') && !processedContent.startsWith('<ul>')) {
        processedContent = '<p class="mb-4">' + processedContent + '</p>';
      }

      containerRef.current.innerHTML = processedContent;
      containerRef.current.classList.add('math-content');
      
      // Force MathJax to render all mathematical content
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([containerRef.current]).catch(console.error);
      }
    }
  }, [content])

  return (
    <div 
      ref={containerRef}
      className={`prose prose-slate max-w-none ${className}`}
      style={{ fontSize: '16px', lineHeight: '1.7' }}
    />
  );
}

// Declare MathJax types for TypeScript
declare global {
  interface Window {
    MathJax: {
      typesetPromise: (elements?: Element[]) => Promise<void>;
      tex: {
        inlineMath: string[][];
        displayMath: string[][];
        processEscapes: boolean;
      };
      options: {
        processHtmlClass: string;
      };
    };
  }
}
