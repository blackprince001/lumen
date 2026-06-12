import { useEffect, useRef, useState } from 'react';
import {
  DocumentUpload as Upload,
  Refresh as Loader2,
  CloseCircle as X,
} from 'iconsax-reactjs';
import { renderLocalPdfCover } from '@/lib/pdf-cover';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils';

export type FileUploadState = 'pending' | 'uploading' | 'processing' | 'done';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function LocalCover({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    let objectUrl: string | null = null;
    void renderLocalPdfCover(file).then((result) => {
      if (!current) {
        if (result) URL.revokeObjectURL(result);
        return;
      }
      objectUrl = result;
      if (result) setUrl(result);
      else setFailed(true);
    });
    return () => {
      current = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return (
    <div className="aspect-[0.7727] w-16 shrink-0 overflow-hidden rounded-md border border-(--border) bg-(--white)">
      {url ? (
        <img src={url} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <div
          className={cn(
            'flex size-full items-center justify-center text-(--muted-foreground)',
            !failed && 'animate-pulse bg-(--muted)',
          )}
        >
          {failed && <Upload size={16} />}
        </div>
      )}
    </div>
  );
}

/**
 * The Ingest hero: PDF drop zone + preview cards (first-page covers rendered
 * locally before upload) with the per-file progress treatment.
 */
export function UploadHero({
  files,
  onFilesAdded,
  onRemove,
  onClear,
  disabled,
  isUploading,
  fileProgressPct,
  fileState,
  maxFiles = 5,
}: {
  files: File[];
  onFilesAdded: (files: File[]) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  disabled: boolean;
  isUploading: boolean;
  fileProgressPct: (index: number) => number;
  fileState: (index: number) => FileUploadState;
  maxFiles?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const canAdd = !disabled && files.length < maxFiles;

  const acceptFiles = (list: FileList | null) => {
    if (!list || !canAdd) return;
    const pdfs = Array.from(list).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfs.length > 0) onFilesAdded(pdfs);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          acceptFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors',
          isDragOver
            ? 'border-(--foreground) bg-(--muted)/40'
            : 'border-(--border)',
          canAdd
            ? 'cursor-pointer hover:border-(--foreground) hover:bg-(--muted)/30'
            : 'cursor-not-allowed opacity-50',
        )}
        onClick={() => canAdd && fileInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (canAdd) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          acceptFiles(event.dataTransfer.files);
        }}
      >
        <Upload size={28} className="mb-2 text-(--muted-foreground)" />
        <p className="mb-1 text-center text-code font-medium text-(--foreground)">
          Drop PDF files here or click to browse
        </p>
        <p className="text-caption text-(--muted-foreground)">
          Max 50MB per file · Up to {maxFiles} files
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-caption font-medium tracking-wider text-(--muted-foreground) uppercase">
              {files.length}/{maxFiles} file(s) selected
            </p>
            {!disabled && (
              <button
                onClick={onClear}
                className="text-caption text-(--muted-foreground) transition-colors hover:text-(--foreground)"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {files.map((file, i) => {
              const state = fileState(i);
              const pct = fileProgressPct(i);
              return (
                <div
                  key={`${file.name}-${file.size}-${i}`}
                  className="flex gap-3 rounded-lg border border-(--border) bg-(--muted) p-2.5"
                >
                  <LocalCover file={file} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-code" title={file.name}>
                        {file.name}
                      </span>
                      {!disabled && (
                        <button
                          onClick={() => onRemove(i)}
                          className="shrink-0 rounded p-1 text-(--muted-foreground) transition-colors hover:bg-(--border) hover:text-(--foreground)"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <span className="text-caption text-(--muted-foreground)">
                      {formatBytes(file.size)}
                    </span>
                    <div className="mt-auto">
                      {isUploading ? (
                        <div className="space-y-1">
                          <Progress
                            value={state === 'processing' ? 100 : pct}
                            fillClassName={state === 'processing' ? 'animate-pulse' : undefined}
                          />
                          <span className="flex items-center gap-1 text-caption text-(--muted-foreground)">
                            {state === 'uploading' && (
                              <>
                                <Loader2 size={10} className="animate-spin" /> uploading…
                              </>
                            )}
                            {state === 'processing' && 'processing…'}
                            {state === 'done' && 'uploaded'}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
