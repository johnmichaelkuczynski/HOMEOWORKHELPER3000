import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, File, X, Image, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing?: boolean;
  accept?: string;
}

export function FileUpload({ onFileSelect, isProcessing = false, accept = ".png,.jpg,.jpeg,.pdf,.doc,.docx" }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-4 h-4 text-blue-500" />;
    }
    return <FileText className="w-4 h-4 text-blue-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-400'
        } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <div className="space-y-4">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto">
            <Upload className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Drop files here or click to upload</p>
            <p className="text-xs text-slate-500 mt-1">Supports: Screenshots, PDF, Word documents</p>
          </div>
          <div className="flex justify-center space-x-4 text-xs text-slate-400">
            <span><Image className="w-3 h-3 inline mr-1" />PNG/JPG</span>
            <span><FileText className="w-3 h-3 inline mr-1" />PDF</span>
            <span><File className="w-3 h-3 inline mr-1" />DOC/DOCX</span>
          </div>
        </div>
        <input
          id="file-input"
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleFileChange}
          disabled={isProcessing}
        />
      </div>

      {selectedFile && (
        <Card className="p-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getFileIcon(selectedFile)}
              <div>
                <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={removeFile}
              disabled={isProcessing}
              className="text-slate-400 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
