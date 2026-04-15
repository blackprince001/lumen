import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { DocumentUpload as Upload, Global as Globe, DocumentUpload as FileUp, Refresh as Loader2, CloseCircle as X } from 'iconsax-reactjs';
import { papersApi } from '@/lib/api/papers';
import { groupsApi } from '@/lib/api/groups';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { toastSuccess, toastError, toastInfo } from '@/lib/utils/toast';
import { cn } from '@/lib/utils';

const SUPPORTED_SOURCES = [
  'arXiv', 'ACM', 'IEEE', 'OpenReview', 'PMLR', 'NeurIPS', 'Semantic Scholar'
];

export default function Ingest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('url');
  const [url, setUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  // Single URL mutation
  const urlMutation = useMutation({
    mutationFn: (data: { url: string; group_ids?: number[] }) => 
      papersApi.create({ title: '', url: data.url, group_ids: data.group_ids }),
    onSuccess: (paper) => {
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      toastSuccess(paper.background_processing_message || 'Paper added successfully');
      setUrl('');
      setSelectedGroupIds([]);
      navigate('/');
    },
    onError: (error: Error) => toastError(`Failed to import: ${error.message}`),
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: (data: { files: File[]; group_ids?: number[] }) => 
      papersApi.uploadFiles(data.files, data.group_ids),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      
      if (response.paper_ids.length > 0) {
        toastInfo(response.message || `${response.paper_ids.length} file(s) uploaded successfully`);
      }
      
      if (response.errors.length > 0) {
        response.errors.forEach(e => toastError(`${e.filename}: ${e.error}`));
      }
      
      setSelectedFiles([]);
      setSelectedGroupIds([]);
      navigate('/');
    },
    onError: (error: Error) => toastError(`Upload failed: ${error.message}`),
  });

  // Batch URL mutation
  const batchMutation = useMutation({
    mutationFn: (data: { urls: string[]; group_ids?: number[] }) => 
      papersApi.ingestBatch(data.urls, data.group_ids),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['papers'] });
      
      if (response.paper_ids.length > 0) {
        toastSuccess(`${response.paper_ids.length} paper(s) imported successfully`);
      }
      
      if (response.errors.length > 0) {
        response.errors.forEach(e => toastError(`${e.url}: ${e.error}`));
      }
      
      setBatchUrls('');
      setSelectedGroupIds([]);
      navigate('/');
    },
    onError: (error: Error) => toastError(`Batch import failed: ${error.message}`),
  });

  const handleSubmit = () => {
    const groupIds = selectedGroupIds.length > 0 ? selectedGroupIds : undefined;
    
    if (activeTab === 'url' && url.trim()) {
      urlMutation.mutate({ url: url.trim(), group_ids: groupIds });
    } else if (activeTab === 'upload' && selectedFiles.length > 0) {
      uploadMutation.mutate({ files: selectedFiles, group_ids: groupIds });
    } else if (activeTab === 'batch' && batchUrls.trim()) {
      const urls = batchUrls.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      batchMutation.mutate({ urls, group_ids: groupIds });
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    setSelectedFiles(prev => [...prev, ...Array.from(files)]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const isProcessing = urlMutation.isPending || uploadMutation.isPending || batchMutation.isPending;

  return (
    <div className="max-w-[56.25rem] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-page-title mb-1">Add Paper</h1>
        <p className="text-body text-[var(--muted-foreground)]">
          Import papers from URLs or upload PDFs directly
        </p>
      </div>

      <div className="space-y-6">
        {/* Groups Selection */}
        {groups && groups.length > 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <h4 className="text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
              Add to Groups (Optional)
            </h4>
            <div className="flex flex-wrap gap-2">
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-code font-medium transition-all border",
                    selectedGroupIds.includes(group.id)
                      ? 'bg-[var(--foreground)] text-[var(--white)] border-[var(--foreground)]'
                      : 'bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--foreground)] hover:bg-[var(--muted)]'
                  )}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Import Methods */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="url">Single URL</TabsTrigger>
              <TabsTrigger value="batch">Batch URLs</TabsTrigger>
              <TabsTrigger value="upload">Upload Files</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="space-y-4">
              <div>
                <label className="block text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                  Paper URL
                </label>
                <Input 
                  placeholder="https://arxiv.org/abs/1706.03762" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={isProcessing}
                  className="h-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-micro text-[var(--muted-foreground)] uppercase tracking-wider">Supported:</span>
                {SUPPORTED_SOURCES.map(s => (
                  <Badge key={s} variant="secondary" className="text-micro h-5">{s}</Badge>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="batch" className="space-y-4">
              <div>
                <label className="block text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                  URLs (one per line)
                </label>
                <textarea
                  placeholder="https://arxiv.org/abs/1706.03762&#10;https://arxiv.org/abs/..."
                  className="w-full bg-[var(--white)] text-[var(--foreground)] text-body px-3 py-2 h-32 rounded-lg border border-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--foreground)] focus:ring-2 focus:ring-[var(--foreground)]/10 resize-none"
                  value={batchUrls}
                  onChange={(e) => setBatchUrls(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />

              <div 
                className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer border-[var(--border)] hover:border-[var(--foreground)] hover:bg-[var(--muted)]/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={28} className="text-[var(--muted-foreground)] mb-2" />
                <p className="text-code font-medium text-[var(--foreground)] text-center mb-1">
                  Drop PDF files here or click to browse
                </p>
                <p className="text-caption text-[var(--muted-foreground)]">Max 50MB per file</p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-caption font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                    {selectedFiles.length} file(s) selected
                  </p>
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-code p-2 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
                      <FileUp size={14} className="text-[var(--muted-foreground)]" />
                      <span className="flex-1 truncate">{file.name}</span>
                      <button 
                        onClick={() => removeFile(i)} 
                        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded hover:bg-[var(--border)] transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Button 
          variant="primary" 
          icon={isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
          onClick={handleSubmit}
          disabled={isProcessing || (activeTab === 'url' && !url.trim()) || (activeTab === 'upload' && selectedFiles.length === 0) || (activeTab === 'batch' && !batchUrls.trim())}
        >
          {isProcessing ? 'Processing...' : 'Import Papers'}
        </Button>
      </div>
    </div>
  );
}
