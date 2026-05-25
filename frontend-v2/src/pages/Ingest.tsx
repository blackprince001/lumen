import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  DocumentUpload as Upload,
  Global as Globe,
  DocumentUpload as FileUp,
  Refresh as Loader2,
  CloseCircle as X,
  ArrowDown2,
  ArrowRight2,
} from 'iconsax-reactjs';
import { papersApi } from '@/lib/api/papers';
import { groupsApi } from '@/lib/api/groups';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { GroupTreeSelector } from '@/components/GroupTreeSelector';
import { toastSuccess, toastError, toastInfo } from '@/lib/utils/toast';
import { cn } from '@/lib/utils';

const SUPPORTED_SOURCES = [
  'arXiv', 'ACM', 'IEEE', 'OpenReview', 'PMLR', 'NeurIPS', 'Semantic Scholar'
];

interface IngestRouteState {
  preselectedGroupIds?: number[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Ingest() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('url');
  const [url, setUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupsExpanded, setGroupsExpanded] = useState(false);

  // Upload progress (bytes)
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [isProcessingServer, setIsProcessingServer] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list(),
  });

  // Seed selected groups from route state (e.g. from GroupDetail "Add Paper")
  useEffect(() => {
    const state = location.state as IngestRouteState | null;
    if (state?.preselectedGroupIds?.length) {
      setSelectedGroupIds(state.preselectedGroupIds);
      setGroupsExpanded(true);
      // Clear state so a refresh / re-navigation doesn't keep re-applying.
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const uploadMutation = useMutation({
    mutationFn: (data: { files: File[]; group_ids?: number[] }) =>
      papersApi.uploadFilesWithProgress(data.files, data.group_ids, (loaded, total) => {
        setUploadProgress({ loaded, total });
        if (loaded >= total) setIsProcessingServer(true);
      }),
    onMutate: () => {
      setUploadProgress({ loaded: 0, total: 1 });
      setIsProcessingServer(false);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['papers'] });

      if (response.paper_ids.length > 0) {
        toastInfo(response.message || `${response.paper_ids.length} file(s) uploaded successfully`);
      }

      if (response.errors.length > 0) {
        response.errors.forEach((e) => toastError(`${e.filename}: ${e.error}`));
      }

      setSelectedFiles([]);
      setSelectedGroupIds([]);
      setUploadProgress(null);
      setIsProcessingServer(false);
      navigate('/');
    },
    onError: (error: Error) => {
      toastError(`Upload failed: ${error.message}`);
      setUploadProgress(null);
      setIsProcessingServer(false);
    },
  });

  const batchMutation = useMutation({
    mutationFn: (data: { urls: string[]; group_ids?: number[] }) =>
      papersApi.ingestBatch(data.urls, data.group_ids),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['papers'] });

      if (response.paper_ids.length > 0) {
        toastSuccess(`${response.paper_ids.length} paper(s) imported successfully`);
      }

      if (response.errors.length > 0) {
        response.errors.forEach((e) => toastError(`${e.url}: ${e.error}`));
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
      const urls = batchUrls.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      batchMutation.mutate({ urls, group_ids: groupIds });
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    setSelectedFiles((prev) => {
      const combined = [...prev, ...incoming];
      if (combined.length > 5) {
        toastError('Maximum 5 files at a time');
        return combined.slice(0, 5);
      }
      return combined;
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const isProcessing = urlMutation.isPending || uploadMutation.isPending || batchMutation.isPending;

  // Aggregate upload metrics (only meaningful during uploadMutation)
  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const aggregatePct = uploadProgress
    ? Math.min(100, Math.round((uploadProgress.loaded / uploadProgress.total) * 100))
    : 0;

  // Per-file progress is derived: distribute global loaded bytes across files in order.
  // (Whole multipart body uploads as one stream — this is a best-effort visualisation.)
  function fileProgressPct(index: number): number {
    if (!uploadProgress || totalSize === 0) return 0;
    if (isProcessingServer) return 100;
    // Bytes uploaded "into" the file region, derived from the global byte count.
    const fileStart = selectedFiles.slice(0, index).reduce((a, f) => a + f.size, 0);
    const fileSize = selectedFiles[index].size;
    // Scale global loaded bytes to the fraction of total that's file content.
    // Multipart overhead is small; treating loaded ≈ file bytes is fine for a UI bar.
    const scaledLoaded = Math.min(totalSize, (uploadProgress.loaded / uploadProgress.total) * totalSize);
    const localLoaded = Math.max(0, Math.min(fileSize, scaledLoaded - fileStart));
    return Math.round((localLoaded / fileSize) * 100);
  }

  function fileState(index: number): 'pending' | 'uploading' | 'processing' | 'done' {
    if (!uploadMutation.isPending) return 'pending';
    if (isProcessingServer) return 'processing';
    const pct = fileProgressPct(index);
    if (pct >= 100) return 'done';
    if (pct > 0) return 'uploading';
    return 'pending';
  }

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
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
            <button
              type="button"
              onClick={() => setGroupsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
              aria-expanded={groupsExpanded}
            >
              <div className="flex items-center gap-2">
                <h4 className="text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                  Add to Groups (Optional)
                </h4>
                {selectedGroupIds.length > 0 && (
                  <Badge variant="secondary" className="text-micro h-5">
                    {selectedGroupIds.length} selected
                  </Badge>
                )}
              </div>
              {groupsExpanded ? (
                <ArrowDown2 size={14} className="text-[var(--muted-foreground)]" />
              ) : (
                <ArrowRight2 size={14} className="text-[var(--muted-foreground)]" />
              )}
            </button>
            {groupsExpanded && (
              <div className="px-6 pb-6">
                <GroupTreeSelector
                  groups={groups}
                  selectedIds={selectedGroupIds}
                  onChange={setSelectedGroupIds}
                  search={groupSearch}
                  onSearchChange={setGroupSearch}
                  heightClass="h-48"
                />
              </div>
            )}
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
              {urlMutation.isPending && (
                <div className="space-y-1.5">
                  <Progress value={100} fillClassName="animate-pulse" />
                  <p className="text-caption text-[var(--muted-foreground)]">Fetching paper…</p>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <span className="text-micro text-[var(--muted-foreground)] uppercase tracking-wider">Supported:</span>
                {SUPPORTED_SOURCES.map((s) => (
                  <Badge key={s} variant="secondary" className="text-micro h-5">
                    {s}
                  </Badge>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="batch" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-caption font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    URLs (one per line, max 5)
                  </label>
                  {batchUrls.trim() && (
                    <button
                      onClick={() => setBatchUrls('')}
                      className="text-caption text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <textarea
                  placeholder="https://arxiv.org/abs/1706.03762&#10;https://arxiv.org/abs/..."
                  className="w-full bg-[var(--white)] text-[var(--foreground)] text-body px-3 py-2 h-32 rounded-lg border border-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--foreground)] focus:ring-2 focus:ring-[var(--foreground)]/10 resize-none"
                  value={batchUrls}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n');
                    const nonEmpty = lines.filter((l) => l.trim().length > 0);
                    if (nonEmpty.length > 5) {
                      toastError('Maximum 5 URLs at a time');
                      return;
                    }
                    setBatchUrls(e.target.value);
                  }}
                  disabled={isProcessing}
                />
                {(() => {
                  const count = batchUrls.split('\n').filter((l) => l.trim().length > 0).length;
                  return count > 0 ? (
                    <p className="text-caption text-[var(--muted-foreground)] mt-1">{count}/5 URLs</p>
                  ) : null;
                })()}
              </div>
              {batchMutation.isPending && (
                <div className="space-y-1.5">
                  <Progress value={100} fillClassName="animate-pulse" />
                  <p className="text-caption text-[var(--muted-foreground)]">Processing URLs…</p>
                </div>
              )}
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
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors border-[var(--border)]',
                  !isProcessing && selectedFiles.length < 5
                    ? 'cursor-pointer hover:border-[var(--foreground)] hover:bg-[var(--muted)]/30'
                    : 'opacity-50 cursor-not-allowed',
                )}
                onClick={() => !isProcessing && selectedFiles.length < 5 && fileInputRef.current?.click()}
              >
                <Upload size={28} className="text-[var(--muted-foreground)] mb-2" />
                <p className="text-code font-medium text-[var(--foreground)] text-center mb-1">
                  Drop PDF files here or click to browse
                </p>
                <p className="text-caption text-[var(--muted-foreground)]">Max 50MB per file · Up to 5 files</p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-caption font-medium uppercase tracking-wider text-[var(--muted-foreground)]">
                      {selectedFiles.length}/5 file(s) selected
                    </p>
                    {!isProcessing && (
                      <button
                        onClick={() => setSelectedFiles([])}
                        className="text-caption text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {uploadMutation.isPending && uploadProgress && (
                    <div className="space-y-1.5 p-3 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
                      <div className="flex items-center justify-between text-caption">
                        <span className="font-medium text-[var(--foreground)]">
                          {isProcessingServer
                            ? 'Processing on server…'
                            : `Uploading ${formatBytes(uploadProgress.loaded)} / ${formatBytes(uploadProgress.total)}`}
                        </span>
                        <span className="text-[var(--muted-foreground)]">
                          {isProcessingServer ? '' : `${aggregatePct}%`}
                        </span>
                      </div>
                      <Progress
                        value={isProcessingServer ? 100 : aggregatePct}
                        fillClassName={isProcessingServer ? 'animate-pulse' : undefined}
                      />
                    </div>
                  )}

                  {selectedFiles.map((file, i) => {
                    const state = fileState(i);
                    const pct = fileProgressPct(i);
                    return (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] space-y-1.5"
                      >
                        <div className="flex items-center gap-2 text-code">
                          <FileUp size={14} className="text-[var(--muted-foreground)]" />
                          <span className="flex-1 truncate">{file.name}</span>
                          <span className="text-caption text-[var(--muted-foreground)] shrink-0">
                            {formatBytes(file.size)}
                          </span>
                          {state === 'uploading' && (
                            <Loader2 size={12} className="text-[var(--muted-foreground)] animate-spin" />
                          )}
                          {state === 'processing' && (
                            <span className="text-caption text-[var(--muted-foreground)]">processing…</span>
                          )}
                          {!isProcessing && (
                            <button
                              onClick={() => removeFile(i)}
                              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded hover:bg-[var(--border)] transition-colors"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        {uploadMutation.isPending && (
                          <Progress
                            value={state === 'processing' ? 100 : pct}
                            fillClassName={state === 'processing' ? 'animate-pulse' : undefined}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Button
          variant="primary"
          icon={isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
          onClick={handleSubmit}
          disabled={
            isProcessing ||
            (activeTab === 'url' && !url.trim()) ||
            (activeTab === 'upload' && selectedFiles.length === 0) ||
            (activeTab === 'batch' && !batchUrls.trim())
          }
        >
          {isProcessing ? 'Processing...' : 'Import Papers'}
        </Button>
      </div>
    </div>
  );
}
