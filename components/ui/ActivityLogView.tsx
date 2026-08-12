'use client';

import { useState, useEffect, useRef } from 'react';
import { History, Plus, Pencil, Trash2, Send, Check, Ban, XCircle, PackageCheck, Truck, MessageSquare, AtSign } from 'lucide-react';

interface FieldChange {
  field: string;
  from: string;
  to: string;
}

interface ActivityLogEntry {
  log_id: string;
  action: string;
  changed_by: string;
  timestamp: string;
  changes: FieldChange[];
}

interface Comment {
  comment_id: string;
  author: string;
  text: string;
  mentions: string[];
  timestamp: string;
}

interface MentionableUser {
  id: string;
  name: string;
}

// A unified feed item — either a system activity entry or a manual comment.
type FeedItem =
  | { kind: 'activity'; timestamp: string; entry: ActivityLogEntry }
  | { kind: 'comment'; timestamp: string; comment: Comment };

const ACTION_ICON: Record<string, React.ElementType> = {
  Created: Plus,
  Updated: Pencil,
  Deleted: Trash2,
  Submitted: Send,
  Approved: Check,
  Rejected: Ban,
  Cancelled: XCircle,
  Amended: Pencil,
  Received: PackageCheck,
  Delivered: Truck,
  Paid: Check,
};

const ACTION_COLOR: Record<string, string> = {
  Created: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  Updated: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  Deleted: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  Submitted: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  Approved: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  Rejected: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  Cancelled: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  Amended: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
  Received: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  Delivered: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  Paid: 'text-green-500 bg-green-50 dark:bg-green-900/20',
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Renders comment text with @Mentioned Names bolded + highlighted.
function renderCommentText(text: string, mentions: string[]) {
  if (mentions.length === 0) return text;
  const sorted = [...mentions].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(@(?:${sorted.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    sorted.some((m) => part === `@${m}`) ? (
      <span key={i} className="font-semibold text-primary bg-primary-50 dark:bg-primary-900/30 rounded px-1">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function ActivityLogView({ doctype, documentId }: { doctype: string; documentId: string }) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchAll = () => {
    setIsLoading(true);
    Promise.all([
      fetch(`/api/activity-log?doctype=${encodeURIComponent(doctype)}&document_id=${encodeURIComponent(documentId)}`).then((res) => (res.ok ? res.json() : [])),
      fetch(`/api/comments?doctype=${encodeURIComponent(doctype)}&document_id=${encodeURIComponent(documentId)}`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([logEntries, commentList]) => {
        setEntries(logEntries);
        setComments(commentList);
      })
      .catch(() => {
        setEntries([]);
        setComments([]);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctype, documentId]);

  useEffect(() => {
    fetch('/api/users/mentionable')
      .then((res) => (res.ok ? res.json() : []))
      .then(setMentionableUsers)
      .catch(() => setMentionableUsers([]));
  }, []);

  const handleTextChange = (value: string) => {
    setCommentText(value);
    const atIndex = value.lastIndexOf('@');
    if (atIndex === -1) {
      setMentionQuery(null);
      return;
    }
    const afterAt = value.slice(atIndex + 1);
    if (/\s{2,}$/.test(afterAt) || afterAt.includes('\n')) {
      setMentionQuery(null);
    } else {
      setMentionQuery(afterAt);
    }
  };

  const insertMention = (name: string) => {
    const atIndex = commentText.lastIndexOf('@');
    const newText = commentText.slice(0, atIndex) + `@${name} `;
    setCommentText(newText);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const filteredMentionCandidates =
    mentionQuery === null
      ? []
      : mentionableUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctype, documentId, text: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText('');
        fetchAll();
      } else {
        const err = await res.json();
        alert(err.error || 'Gagal mengirim komentar');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-xs text-gray-400 py-4 text-center">Memuat riwayat...</p>;
  }

  const feed: FeedItem[] = [
    ...entries.map((entry): FeedItem => ({ kind: 'activity', timestamp: entry.timestamp, entry })),
    ...comments.map((comment): FeedItem => ({ kind: 'comment', timestamp: comment.timestamp, comment })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={commentText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={`Tambah komentar... ketik @ untuk tag orang`}
          rows={2}
          className="input-field text-xs resize-none"
        />
        {mentionQuery !== null && filteredMentionCandidates.length > 0 && (
          <div className="absolute z-10 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden">
            {filteredMentionCandidates.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u.name)}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
              >
                <AtSign size={11} className="text-gray-400" />
                {u.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-1.5">
          <button
            type="button"
            disabled={isSaving || !commentText.trim()}
            onClick={handleSubmitComment}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary-600 disabled:opacity-40"
          >
            <MessageSquare size={12} /> Kirim
          </button>
        </div>
      </div>

      {feed.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-4 justify-center">
          <History size={14} />
          Belum ada riwayat perubahan
        </div>
      ) : (
        <div className="space-y-3">
          {feed.map((item) => {
            if (item.kind === 'comment') {
              const c = item.comment;
              return (
                <div key={`c-${c.comment_id}`} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-purple-500 bg-purple-50 dark:bg-purple-900/20">
                    <MessageSquare size={12} />
                  </div>
                  <div className="flex-1 min-w-0 pb-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{c.author || 'Unknown'}</span>{' '}
                      berkomentar
                      <span className="text-gray-400"> · {formatTimestamp(c.timestamp)}</span>
                    </p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                      {renderCommentText(c.text, c.mentions)}
                    </p>
                  </div>
                </div>
              );
            }

            const entry = item.entry;
            const Icon = ACTION_ICON[entry.action] || Pencil;
            const color = ACTION_COLOR[entry.action] || 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
            return (
              <div key={`a-${entry.log_id}`} className="flex gap-2.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon size={12} />
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{entry.changed_by || 'System'}</span>{' '}
                    {entry.action.toLowerCase()}
                    <span className="text-gray-400"> · {formatTimestamp(entry.timestamp)}</span>
                  </p>
                  {entry.changes.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {entry.changes.map((c, i) => (
                        <p key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
                          <span className="font-medium">{c.field}</span>:{' '}
                          <span className="line-through text-red-400">{c.from || '(kosong)'}</span>{' '}
                          → <span className="text-green-600 dark:text-green-400">{c.to || '(kosong)'}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
