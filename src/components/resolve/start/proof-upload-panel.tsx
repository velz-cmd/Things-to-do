"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import clsx from "clsx";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { StatusChip } from "@/components/resolve/ui/status-chip";
import { toast } from "sonner";

export type EvidenceFileRow = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  hash: string;
  status: string;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  uploaded: "File received",
  extracting: "Extracting text",
  candidate: "Evidence candidate",
  verified: "Verified",
  rejected: "Rejected",
};

export function ProofUploadPanel({
  taskId,
  files,
  onRefresh,
}: {
  taskId?: string | null;
  files: EvidenceFileRow[];
  onRefresh: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      setUploading(true);
      try {
        for (const file of Array.from(fileList)) {
          const form = new FormData();
          form.append("file", file);
          if (taskId) form.append("taskId", taskId);
          const res = await fetch("/api/evidence/upload", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Upload failed");
        }
        toast.success("Files uploaded");
        onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [taskId, onRefresh]
  );

  async function removeFile(id: string) {
    const res = await fetch(`/api/evidence/file/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove file");
      return;
    }
    onRefresh();
  }

  async function markAsEvidence(id: string) {
    if (!taskId) {
      toast.message("Start a task first");
      return;
    }
    const res = await fetch(`/api/evidence/file/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "use", taskId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast.success(data.message);
    onRefresh();
  }

  return (
    <GlassPanel className="p-5">
      <h2 className="text-sm font-semibold text-white">Proof upload</h2>
      <p className="mt-1 text-xs text-resolve-muted">
        Receipts, invoices, screenshots, PDFs, videos, or ZIP files.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
        className={clsx(
          "mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
          dragging
            ? "border-sky-500/50 bg-sky-500/5"
            : "border-white/10 bg-black/20"
        )}
      >
        <Upload className="h-8 w-8 text-resolve-muted" />
        <p className="mt-2 text-sm text-resolve-muted">
          Drop receipts, invoices, screenshots, PDFs, videos, or ZIP files here
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.mov,.zip,.csv,.txt,.docx,.xlsx"
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-full bg-sky-500/20 px-4 py-2 text-xs font-medium text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          {uploading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
            </span>
          ) : (
            "Upload files"
          )}
        </button>
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
            >
              <FileText className="h-4 w-4 shrink-0 text-sky-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{f.fileName}</p>
                <p className="font-mono text-[10px] text-resolve-muted">
                  {f.hash.slice(0, 14)}…
                </p>
              </div>
              <StatusChip
                label={STATUS_LABEL[f.status] ?? f.status}
                variant={f.status === "verified" ? "verified" : "neutral"}
              />
              <div className="flex gap-1">
                {taskId && f.status === "candidate" && (
                  <button
                    type="button"
                    onClick={() => void markAsEvidence(f.id)}
                    className="text-[10px] text-sky-400 hover:underline"
                  >
                    Use
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void removeFile(f.id)}
                  className="text-resolve-muted hover:text-white"
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
