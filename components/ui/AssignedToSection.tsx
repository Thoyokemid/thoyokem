'use client';

import { useState, useEffect, useRef } from 'react';
import { UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Assignment {
  assignment_id: string;
  assigned_to: string;
  assigned_to_name: string;
  photo_url?: string;
  assigned_by: string;
  note: string;
  timestamp: string;
}

interface MentionableUser {
  id: string;
  name: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function AssignedToSection({ doctype, documentId }: { doctype: string; documentId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<MentionableUser[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const fetchAssignments = () => {
    fetch(`/api/assignments?doctype=${encodeURIComponent(doctype)}&document_id=${encodeURIComponent(documentId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setAssignments)
      .catch(() => setAssignments([]))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctype, documentId]);

  useEffect(() => {
    fetch('/api/users/mentionable')
      .then((res) => (res.ok ? res.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setIsPickerOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const assign = async (userId: string) => {
    setIsPickerOpen(false);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctype, document_id: documentId, assigned_to: userId }),
      });
      if (res.ok) {
        fetchAssignments();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gagal assign user');
      }
    } catch (error) {
      console.error('Error assigning user:', error);
      toast.error('Gagal assign user');
    }
  };

  const unassign = async (assignmentId: string) => {
    setBusyId(assignmentId);
    const previous = assignments;
    setAssignments((prev) => prev.filter((a) => a.assignment_id !== assignmentId));
    try {
      const res = await fetch(`/api/assignments?id=${encodeURIComponent(assignmentId)}`, { method: 'DELETE' });
      if (!res.ok) {
        setAssignments(previous);
        toast.error('Gagal batalkan assignment');
      }
    } catch (error) {
      console.error('Error unassigning:', error);
      setAssignments(previous);
      toast.error('Gagal batalkan assignment');
    } finally {
      setBusyId(null);
    }
  };

  const assignableUsers = users.filter((u) => !assignments.some((a) => a.assigned_to === u.id));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <UserPlus size={14} />
          Assigned To {assignments.length > 0 && `(${assignments.length})`}
        </h2>
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setIsPickerOpen((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            + Assign
          </button>
          {isPickerOpen && (
            <div className="absolute right-0 z-10 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden max-h-56 overflow-y-auto">
              {assignableUsers.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400 text-center">Semua user sudah di-assign</p>
              ) : (
                assignableUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => assign(u.id)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {u.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400 text-center py-2">Memuat...</p>
      ) : assignments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">Belum ada yang di-assign</p>
      ) : (
        <div className="space-y-1.5">
          {assignments.map((a) => (
            <div key={a.assignment_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/40">
              {a.photo_url ? (
                <img src={a.photo_url} alt={a.assigned_to_name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(a.assigned_to_name)}
                </span>
              )}
              <span className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-300 truncate">{a.assigned_to_name}</span>
              <button
                onClick={() => unassign(a.assignment_id)}
                disabled={busyId === a.assignment_id}
                className="flex-shrink-0 p-0.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-40"
                title="Batalkan assign"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
