'use client';

import { useState, useEffect, useRef } from 'react';
import { Paperclip, Upload, Trash2, FileText, Image as ImageIcon, Download } from 'lucide-react';
import Loading from '@/components/ui/Loading';

interface AttachmentItem {
  attachment_id: string;
  file_name: string;
  file_url: string;
  uploaded_by: string;
  timestamp: string;
}

interface AttachmentSectionProps {
  doctype: string;
  documentId: string;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isImage(fileName: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName);
}

export default function AttachmentSection({ doctype, documentId }: AttachmentSectionProps) {
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    try {
      const res = await fetch(`/api/attachments?doctype=${encodeURIComponent(doctype)}&document_id=${encodeURIComponent(documentId)}`);
      if (res.ok) setAttachments(await res.json());
    } catch (err) {
      console.error('Error fetching attachments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [doctype, documentId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doctype', doctype);
      fd.append('document_id', documentId);
      const res = await fetch('/api/attachments', { method: 'POST', body: fd });
      if (res.ok) {
        fetchAttachments();
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal mengunggah file');
      }
    } catch (err) {
      console.error('Error uploading attachment:', err);
      setError('Gagal mengunggah file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Hapus lampiran ini?')) return;
    setDeletingId(attachmentId);
    try {
      const res = await fetch(`/api/attachments?id=${encodeURIComponent(attachmentId)}`, { method: 'DELETE' });
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.attachment_id !== attachmentId));
      }
    } catch (err) {
      console.error('Error deleting attachment:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <Paperclip size={14} />
          Lampiran {attachments.length > 0 && `(${attachments.length})`}
        </h2>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer hover:underline">
          <Upload size={13} />
          {isUploading ? 'Mengunggah...' : 'Tambah File'}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loading size="sm" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Belum ada lampiran</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((a) => {
            const Icon = isImage(a.file_name) ? ImageIcon : FileText;
            return (
              <div
                key={a.attachment_id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
              >
                <Icon size={16} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={a.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-900 dark:text-gray-100 hover:text-primary truncate block"
                  >
                    {a.file_name}
                  </a>
                  <p className="text-[11px] text-gray-400">
                    {a.uploaded_by} &middot; {formatTimestamp(a.timestamp)}
                  </p>
                </div>
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Unduh"
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-primary rounded"
                >
                  <Download size={14} />
                </a>
                <button
                  onClick={() => handleDelete(a.attachment_id)}
                  disabled={deletingId === a.attachment_id}
                  title="Hapus"
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-40"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
