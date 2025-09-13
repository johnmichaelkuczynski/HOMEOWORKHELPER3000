import { v4 as uuidv4 } from 'uuid';
import { TextChunk } from '../../shared/schema';

export class TextChunkerService {
  private readonly CHUNK_SIZE = 300; // words per chunk
  private readonly OVERLAP_SIZE = 50; // words to overlap between chunks

  chunkText(text: string): TextChunk[] {
    const words = text.trim().split(/\s+/);
    const chunks: TextChunk[] = [];
    
    if (words.length <= this.CHUNK_SIZE) {
      // If text is small enough, return as single chunk
      return [{
        id: uuidv4(),
        content: text.trim(),
        startWord: 0,
        endWord: words.length - 1,
      }];
    }

    let startWord = 0;
    let chunkIndex = 0;

    while (startWord < words.length) {
      const endWord = Math.min(startWord + this.CHUNK_SIZE - 1, words.length - 1);
      const chunkWords = words.slice(startWord, endWord + 1);
      const content = chunkWords.join(' ');

      chunks.push({
        id: uuidv4(),
        content,
        startWord,
        endWord,
      });

      // Move start position for next chunk, accounting for overlap
      startWord = endWord + 1 - this.OVERLAP_SIZE;
      
      // Ensure we don't go backwards
      if (startWord <= chunks[chunkIndex]?.startWord) {
        startWord = endWord + 1;
      }

      chunkIndex++;

      // Break if we've reached the end
      if (endWord >= words.length - 1) {
        break;
      }
    }

    return chunks;
  }

  getReconstructedText(chunks: TextChunk[], selectedChunkIds: string[]): string {
    const selectedChunks = chunks
      .filter(chunk => selectedChunkIds.includes(chunk.id))
      .sort((a, b) => a.startWord - b.startWord);

    if (selectedChunks.length === 0) {
      return '';
    }

    // Merge overlapping or adjacent chunks
    const mergedContent: string[] = [];
    let lastEndWord = -1;

    for (const chunk of selectedChunks) {
      if (chunk.startWord > lastEndWord + 1) {
        // There's a gap, add the chunk as-is
        mergedContent.push(chunk.content);
      } else {
        // There's overlap or adjacency, merge intelligently
        const lastContent = mergedContent[mergedContent.length - 1];
        const lastWords = lastContent.split(/\s+/);
        const currentWords = chunk.content.split(/\s+/);
        
        // Find overlap and merge
        let overlapStart = Math.max(0, lastWords.length - (lastEndWord - chunk.startWord + 1));
        const mergedWords = [
          ...lastWords.slice(0, overlapStart),
          ...currentWords
        ];
        
        mergedContent[mergedContent.length - 1] = mergedWords.join(' ');
      }
      
      lastEndWord = chunk.endWord;
    }

    return mergedContent.join(' ');
  }

  getChunkStats(chunks: TextChunk[]): {
    totalChunks: number;
    totalWords: number;
    averageWordsPerChunk: number;
  } {
    const totalWords = chunks.reduce((sum, chunk) => {
      return sum + chunk.content.split(/\s+/).length;
    }, 0);

    return {
      totalChunks: chunks.length,
      totalWords,
      averageWordsPerChunk: Math.round(totalWords / chunks.length),
    };
  }

  selectAllChunks(chunks: TextChunk[]): string[] {
    return chunks.map(chunk => chunk.id);
  }

  selectChunksByRange(chunks: TextChunk[], startIndex: number, endIndex: number): string[] {
    return chunks
      .slice(startIndex, endIndex + 1)
      .map(chunk => chunk.id);
  }
}

export const textChunkerService = new TextChunkerService();