import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bell, Target, Trash2, AlertTriangle, CheckCircle2, Info, LogOut, UserCircle2, Ticket, Copy, Check, XCircle, Mail, Send } from 'lucide-react';
import { settingsService, AppSettings } from '../services/settings_service';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface InviteInfo {
  code: string;
  email: string | null;
  created_by: string;
  created_at: string;
  used: boolean;
  used_by: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const InvitesPanel: React.FC = () => {
  const [invites, setInvites] = useState<InviteInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.listInvites();
      setInvites(data.reverse());
    } catch (e) {
      setError('Failed to load invites.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleGenerate = async () => {
    setError(null);
    const clean = inviteEmail.trim();
    if (!EMAIL_PATTERN.test(clean)) {
      setError('Enter a valid email address to invite.');
      return;
    }
    setIsGenerating(true);
    try {
      await apiService.createInvite(clean);
      setInviteEmail('');
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to generate invite.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (code: string) => {
    try {
      await apiService.revokeInvite(code);
      await refresh();
    } catch (e) {
      setError('Failed to revoke invite.');
    }
  };

  const buildLink = (invite: InviteInfo) => {
    const params = new URLSearchParams({ code: invite.code });
    if (invite.email) params.set('email', invite.email);
    return `${window.location.origin}/signup?${params.toString()}`;
  };

  const handleCopy = (invite: InviteInfo) => {
    navigator.clipboard.writeText(buildLink(invite)).then(() => {
      setCopiedCode(invite.code);
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(() => setError('Could not copy to clipboard — copy the code manually.'));
  };

  // No SMTP/email service is configured, so this opens the admin's own
  // mail client pre-filled with the invite link rather than sending
  // anything server-side.
  const handleEmailInvite = (invite: InviteInfo) => {
    if (!invite.email) return;
    const subject = encodeURIComponent('Your STONKS invite');
    const body = encodeURIComponent(`You've been invited to STONKS. Sign up here:\n\n${buildLink(invite)}`);
    window.location.href = `mailto:${invite.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="bg-surface border border-borderDark p-5 rounded-2xl shadow-lg flex flex-col gap-4">
      <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
        <Ticket className="w-4 h-4 text-brand" />
        <span>Invites</span>
      </h3>
      <p className="text-[11px] text-textMuted -mt-2">Invite-only access — generate a link for one email address at a time, then share it however you like.</p>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Mail className="w-3.5 h-3.5 text-textMuted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="friend@example.com"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-background border border-borderDark focus:border-brand/60 outline-none text-xs text-white font-mono transition-all"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !inviteEmail.trim()}
          className="px-3.5 py-2 rounded-lg bg-brand text-black text-xs font-mono font-bold hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none transition-all shrink-0"
        >
          {isGenerating ? 'Generating...' : 'Generate Invite'}
        </button>
      </div>

      {error && <p className="text-xs text-bearish font-mono">{error}</p>}

      {isLoading ? (
        <p className="text-xs text-textMuted">Loading...</p>
      ) : invites.length === 0 ? (
        <p className="text-xs text-textMuted">No invites yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {invites.map(invite => (
            <div key={invite.code} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background border border-borderDark/60">
              <div className="min-w-0">
                <span className="text-xs font-mono text-slate-200 truncate block">{invite.email || invite.code}</span>
                <span className={`text-[11px] font-mono ${invite.used ? 'text-textMuted' : 'text-emerald-400'}`}>
                  {invite.used ? `Used by ${invite.used_by}` : 'Unused'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!invite.used && (
                  <>
                    {invite.email && (
                      <button
                        onClick={() => handleEmailInvite(invite)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-borderDark text-slate-300 hover:text-white text-[11px] font-mono font-bold transition-all"
                        title={`Open email to ${invite.email}`}
                      >
                        <Send className="w-3 h-3" />
                        <span>Email</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(invite)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-borderDark text-slate-300 hover:text-white text-[11px] font-mono font-bold transition-all"
                    >
                      {copiedCode === invite.code ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode === invite.code ? 'Copied' : 'Copy Link'}</span>
                    </button>
                    <button
                      onClick={() => handleRevoke(invite.code)}
                      className="p-1.5 rounded-lg text-textMuted hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Revoke invite"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.getSettings());
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [resetDone, setResetDone] = useState<boolean>(false);
  const { username, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const update = (patch: Partial<AppSettings>) => {
    setSettings(settingsService.updateSettings(patch));
  };

  const handleReset = () => {
    settingsService.resetAllData();
    setConfirmReset(false);
    setResetDone(true);
    setTimeout(() => setResetDone(false), 4000);
  };

  return (
    <div className="min-h-screen bg-background text-text font-sans p-6 md:p-8 flex flex-col gap-6 max-w-3xl mx-auto">

      <div className="border-b border-borderDark/80 pb-5">
        <h1 className="font-extrabold text-2xl text-white tracking-tight flex items-center gap-2.5 font-mono">
          <SettingsIcon className="w-6 h-6 text-brand" />
          <span>Settings</span>
        </h1>
        <p className="text-xs text-textMuted mt-1">Notification preferences and local data controls.</p>
      </div>

      {/* Account */}
      <div className="bg-surface border border-borderDark p-5 rounded-2xl shadow-lg flex flex-col gap-4">
        <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
          <UserCircle2 className="w-4 h-4 text-brand" />
          <span>Account</span>
        </h3>
        <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-borderDark/60">
          <div>
            <span className="text-sm text-slate-200 font-semibold">Signed in as {username || 'admin'}</span>
            <p className="text-[11px] text-textMuted mt-0.5">End your current session on this device.</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-mono font-bold transition-all flex-shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* Invites (admin only) */}
      {isAdmin && <InvitesPanel />}

      {/* Notification Preferences */}
      <div className="bg-surface border border-borderDark p-5 rounded-2xl shadow-lg flex flex-col gap-4">
        <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
          <Bell className="w-4 h-4 text-brand" />
          <span>Watchlist Alerts</span>
        </h3>

        <label className="flex items-center justify-between p-3 rounded-xl bg-background border border-borderDark/60 cursor-pointer hover:border-brand/40">
          <div>
            <span className="text-sm text-slate-200 font-semibold">Enable notifications</span>
            <p className="text-[11px] text-textMuted mt-0.5">Master switch — turns all watchlist alerts on or off.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={e => update({ notificationsEnabled: e.target.checked })}
            className="accent-brand w-4 h-4 cursor-pointer flex-shrink-0"
          />
        </label>

        <label className={`flex items-center justify-between p-3 rounded-xl bg-background border border-borderDark/60 transition-opacity ${settings.notificationsEnabled ? 'cursor-pointer hover:border-brand/40' : 'opacity-40 pointer-events-none'}`}>
          <div>
            <span className="text-sm text-slate-200 font-semibold">Recommendation & confidence changes</span>
            <p className="text-[11px] text-textMuted mt-0.5">Alert when a watched stock's AI rating flips or confidence shifts ≥10%.</p>
          </div>
          <input
            type="checkbox"
            checked={settings.notifyOnRecommendationChange}
            onChange={e => update({ notifyOnRecommendationChange: e.target.checked })}
            className="accent-brand w-4 h-4 cursor-pointer flex-shrink-0"
          />
        </label>

        <label className={`flex items-center justify-between p-3 rounded-xl bg-background border border-borderDark/60 transition-opacity ${settings.notificationsEnabled ? 'cursor-pointer hover:border-brand/40' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-textMuted mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-sm text-slate-200 font-semibold">Target / stop-loss shifts</span>
              <p className="text-[11px] text-textMuted mt-0.5">Alert when a watched stock's target or stop moves ≥3%.</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.notifyOnTargetStopShift}
            onChange={e => update({ notifyOnTargetStopShift: e.target.checked })}
            className="accent-brand w-4 h-4 cursor-pointer flex-shrink-0"
          />
        </label>
      </div>

      {/* Data Management */}
      <div className="bg-surface border border-borderDark p-5 rounded-2xl shadow-lg flex flex-col gap-4">
        <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>Local Data</span>
        </h3>
        <p className="text-xs text-textMuted flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Your watchlist, tracked trades, chart layout, drawings, and notification history are all stored only in this browser — nothing is sent to a server. Resetting clears them permanently on this device.</span>
        </p>

        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="self-start flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-mono font-bold transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset All Local Data</span>
          </button>
        ) : (
          <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <div className="flex items-center gap-2 text-rose-400 text-xs font-mono font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>This cannot be undone. Clear watchlist, trades, drawings, and notifications now?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-mono font-bold hover:bg-rose-600 transition-all"
              >
                Yes, reset everything
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-4 py-1.5 rounded-lg bg-background border border-borderDark text-slate-300 text-xs font-mono font-bold hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {resetDone && (
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>All local data cleared.</span>
          </div>
        )}
      </div>
    </div>
  );
};
