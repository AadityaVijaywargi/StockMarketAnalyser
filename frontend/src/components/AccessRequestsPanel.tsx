import React, { useEffect, useState } from 'react';
import { Inbox, Check, Copy, Send, Trash2, UserCheck, Loader2, RefreshCw } from 'lucide-react';
import { apiService, AccessRequest } from '../services/api';
import { buildInviteLink, buildInviteMailto } from '../utils/invite_links';

/**
 * Admin review queue for requests submitted from the public
 * /request-access page. Approving issues an invite for the requester's email
 * in one step (and marks the request invited server-side); the resulting
 * link can then be emailed or copied straight from the row.
 */

type Filter = 'pending' | 'all';

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const AccessRequestsPanel: React.FC<{ onInviteCreated: () => void }> = ({ onInviteCreated }) => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Invite codes issued during this session, keyed by request id, so the
  // row can offer Email / Copy right after approval.
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRequests(await apiService.listAccessRequests());
    } catch {
      setError('Failed to load access requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleApprove = async (req: AccessRequest) => {
    setBusyId(req.id);
    setError(null);
    try {
      const { code } = await apiService.approveAccessRequest(req.id);
      setIssued(prev => ({ ...prev, [req.id]: code }));
      setRequests(prev => prev.map(r => (r.id === req.id ? { ...r, status: 'invited' } : r)));
      onInviteCreated();
    } catch (e: any) {
      setError(e?.response?.data?.detail || `Failed to approve ${req.email}.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (req: AccessRequest) => {
    setBusyId(req.id);
    setError(null);
    try {
      await apiService.deleteAccessRequest(req.id);
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } catch {
      setError(`Failed to dismiss ${req.email}.`);
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleCopy = (req: AccessRequest, code: string) => {
    navigator.clipboard.writeText(buildInviteLink(code, req.email)).then(() => {
      setCopiedId(req.id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => setError('Could not copy to clipboard.'));
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const visible = filter === 'pending' ? requests.filter(r => r.status === 'pending') : requests;

  const tabClass = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
      active ? 'bg-white/[0.08] text-white' : 'text-textMuted hover:text-white'
    }`;

  return (
    <section
      aria-labelledby="access-requests-heading"
      className="bg-surface border border-borderDark p-5 rounded-2xl shadow-lg flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="access-requests-heading" className="font-bold text-sm text-white font-mono flex items-center gap-2">
          <Inbox className="w-4 h-4 text-brandText" aria-hidden="true" />
          <span>Access Requests</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-brand text-white text-[10px] leading-none">
              {pendingCount} new
            </span>
          )}
        </h3>
        <button
          onClick={refresh}
          disabled={isLoading}
          aria-label="Refresh access requests"
          className="p-1.5 rounded-lg text-textMuted hover:text-white hover:bg-white/[0.05] disabled:opacity-40 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>
      <p className="text-[11px] text-textMuted -mt-2">
        People who asked for access from the public site. Approving creates an invite for their email.
      </p>

      <div role="tablist" aria-label="Filter requests" className="flex items-center gap-1 -mt-1">
        <button role="tab" aria-selected={filter === 'pending'} onClick={() => setFilter('pending')} className={tabClass(filter === 'pending')}>
          Pending ({pendingCount})
        </button>
        <button role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')} className={tabClass(filter === 'all')}>
          All ({requests.length})
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-bearish font-mono">{error}</p>}

      {isLoading && requests.length === 0 ? (
        <p className="text-xs text-textMuted">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-textMuted">
          {filter === 'pending' ? 'No pending requests.' : 'No access requests yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(req => {
            const code = issued[req.id];
            const isBusy = busyId === req.id;
            const isInvited = req.status === 'invited';
            return (
              <li key={req.id} className="p-3 rounded-xl bg-background border border-borderDark/60 flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-200 break-all block">{req.email}</span>
                    <span className="text-[11px] font-mono text-textMuted">
                      {formatDate(req.created_at)}
                      {' · '}
                      <span className={isInvited ? 'text-emerald-400' : 'text-amber-400'}>
                        {isInvited ? 'Invited' : 'Pending'}
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {code ? (
                      <>
                        <a
                          href={buildInviteMailto(code, req.email)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-[11px] font-mono font-bold hover:brightness-110 transition-all"
                        >
                          <Send className="w-3 h-3" aria-hidden="true" />
                          <span>Email invite</span>
                        </a>
                        <button
                          onClick={() => handleCopy(req, code)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-borderDark text-slate-300 hover:text-white text-[11px] font-mono font-bold transition-all"
                        >
                          {copiedId === req.id
                            ? <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                            : <Copy className="w-3 h-3" aria-hidden="true" />}
                          <span>{copiedId === req.id ? 'Copied' : 'Copy link'}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={isBusy}
                        title={isInvited ? 'Issue a fresh invite code for this email' : undefined}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all disabled:opacity-40 disabled:pointer-events-none ${
                          isInvited
                            ? 'bg-white/[0.04] border border-borderDark text-slate-300 hover:text-white'
                            : 'bg-brand text-white hover:brightness-110'
                        }`}
                      >
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <UserCheck className="w-3 h-3" aria-hidden="true" />}
                        <span>{isInvited ? 'Re-invite' : 'Approve'}</span>
                      </button>
                    )}

                    {confirmDeleteId === req.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(req)}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px] font-mono font-bold hover:bg-rose-500/25 disabled:opacity-40 transition-all"
                        >
                          Confirm dismiss
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 text-[11px] font-mono text-textMuted hover:text-white transition-all"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(req.id)}
                        disabled={isBusy}
                        aria-label={`Dismiss request from ${req.email}`}
                        title="Dismiss request"
                        className="p-1.5 rounded-lg text-textMuted hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {req.message && (
                  <p className="text-[11px] text-textMuted leading-relaxed whitespace-pre-wrap break-words border-l-2 border-borderDark pl-2.5">
                    {req.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default AccessRequestsPanel;
