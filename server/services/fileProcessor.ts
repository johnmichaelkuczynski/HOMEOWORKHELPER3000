import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';

export interface ProcessedFile {
  id: string;
  filename: string;
  content: string;
  wordCount: number;
}

export class FileProcessorService {
  async processFile(fileBuffer: Buffer, filename: string): Promise<ProcessedFile> {
    const extension = filename.toLowerCase().split('.').pop();
    let content = '';

    try {
      switch (extension) {
        case 'txt':
          content = fileBuffer.toString('utf-8');
          break;
        case 'docx':
          const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
          content = docxResult.value;
          break;
        case 'pdf':
          throw new Error('PDF processing temporarily disabled');
          break;
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }

      const wordCount = this.countWords(content);

      return {
        id: uuidv4(),
        filename,
        content: content.trim(),
        wordCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to process file ${filename}: ${errorMessage}`);
    }
  }

  // PDF processing temporarily disabled due to library issues

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  isValidFileType(filename: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();
    return ['txt', 'docx', 'pdf'].includes(extension || '');
  }

  getMaxFileSize(): number {
    return 10 * 1024 * 1024; // 10MB
  }
}

export const fileProcessorService = new FileProcessorService();