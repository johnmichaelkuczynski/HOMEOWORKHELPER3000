# Homework Assistant

## Overview

The Homework Assistant is a full-stack web application designed to provide AI-powered solutions for various homework types. It accepts text, image, PDF, and document inputs, leveraging multiple Large Language Models (LLMs) to generate detailed answers. Key capabilities include drag-and-drop file uploads, voice input, mathematical notation rendering, and PDF export. The project aims to offer a comprehensive, user-friendly tool for academic assistance, with ambitions to serve a wide market of students and educators.

## User Preferences

Preferred communication style: Simple, everyday language.
Username jmkuczynski: Unlimited access with 99,999,999 tokens (maximum credits) - no password required.
Username randyjohnson: Unlimited access with 99,999,999 tokens (maximum credits) - no password required.

## System Architecture

The application employs a clear client-server architecture.

### Frontend
- **Framework**: React 18 with TypeScript and Vite
- **UI/Styling**: Shadcn/ui (Radix UI) and Tailwind CSS for a modern, responsive design.
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Display**: MathJax for mathematical notation and integrated image display for graphs.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM.
- **File Processing**: Multer for uploads (PDFs, images, documents), Tesseract.js for OCR, pdf2json for PDF text extraction.
- **Graph Generation**: Chart.js with ChartJSNodeCanvas for server-side graph creation.

### Core Features & Design Patterns
- **File Processing Pipeline**: Standardized process from upload to text extraction, LLM processing, graph detection, and response generation.
- **Integrated Graph Generation**: Automatic detection and server-side creation of graphs (line, bar, scatter) based on LLM-generated data, seamlessly embedded into solutions. Supports multiple graphs per assignment.
- **LLM Integration**: Designed for multiple AI providers, allowing user selection and leveraging their capabilities for detailed solutions. Intelligent content detection ensures LaTeX notation is applied only to mathematical problems.
- **Voice Input**: Utilizes browser Web Speech API and Azure Speech Services for real-time transcription.
- **Mathematical Notation**: MathJax integration provides full LaTeX support, optimized for display and PDF export.
- **Token-Based Payment System**: Implemented with PayPal integration for user authentication and session tracking.
- **Multi-User Data Isolation**: A single shared PostgreSQL database enforces user-scoped data access via `user_id` filtering, preventing cross-user data access and ensuring secure deletion. Includes support for anonymous users.
- **GPT BYPASS**: Integrated functionality for text rewriting and AI detection score reduction, with a dedicated interface and seamless workflow between homework assistant and bypass features.

## External Dependencies

- **Database**: PostgreSQL
- **LLM APIs**: Anthropic, OpenAI, Azure OpenAI, DeepSeek, Perplexity
- **Payment Gateway**: PayPal
- **CDN Services**: MathJax, Google Fonts
- **Speech Services**: Azure Cognitive Services (optional)

## Recent Changes

### September 11, 2025
- Fixed jmkuczynski login authentication issue
  - Resolved case sensitivity problem in username comparison (frontend sent "JMKUCZYNSKI", backend expected "jmkuczynski")
  - Updated backend login route to use case-insensitive username matching
  - Both jmkuczynski and randyjohnson can now login without passwords as intended
- Updated Contact Us link to be a small, non-floating text link at the top of both homework assistant and GPT BYPASS pages (linking to contact@zhisystems.ai)
- Implemented chunked processing for GPT BYPASS function:
  - Automatically splits large documents (over 800 words) into 700-word chunks
  - Added user controls to select/deselect specific chunks for processing
  - Includes 'Select All' and 'Select None' buttons for chunk selection
  - Processes selected chunks sequentially with individual AI scoring and progress tracking