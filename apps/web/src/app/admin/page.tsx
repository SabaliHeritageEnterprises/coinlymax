'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';
import {
  listenUsers, listenActivity, adminUpdateUser, adminAdjustBalance, computeOnline, isAdmin,
  type AppUser,
} from '@/lib/fb';
import { LineChart, Users, Activity, Circle, MessageCircle, Shield, TrendingUp } from 'lucide-react';
import AdminChat from './chat/page';
import AdminKYC from './kyc/page';
import AdminTrades from './trades/page';

type Tab = 'overview' | 'users' | 'activity' | 'chat' | 'kyc' | 'trades';
const LAST_VIEWED_KEY = 'apex_admin_activity_lastViewed';
const fmtUsd = (n: number) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const tsToDate = (t: any): Date | null => t?.toDate?.() ?? null;

export default function AdminPage() {
  const { user, initialized } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');

  const [users, setUsers] = useState<AppUser[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [lastViewed, setLastViewed] = useState<number>(0);

  // Guard: admins only
  useEffect(() => {
    if (initialized && (!user || !isAdmin(user.role))) router.replace('/dashboard');
  }, [initialized, user, router]);

  // Live Firestore subscriptions
  useEffect(() => {
    if (!user || !isAdmin(user.role)) return;
    const u1 = listenUsers(setUsers);
    const u2 = listenActivity(setActivity, 150);
    return () => { u1(); u2(); };
  }, [user]);

  useEffect(() => {
    setLastViewed(Number(localStorage.getItem(LAST_VIEWED_KEY) ?? 0));
  }, []);

  const onlineMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    users.forEach((u) => { m[u.uid] = computeOnline(u); });
    return m;
  }, [users]);

  const newLogins = useMemo(
    () => activity.filter((a) => a.type === 'login' && (tsToDate(a.timestamp)?.getTime() ?? 0) > lastViewed).length,
    [activity, lastViewed],
  );

  const openActivity = () => {
    const now = Date.now();
    localStorage.setItem(LAST_VIEWED_KEY, String(now));
    setLastViewed(now);
    setTab('activity');
  };

  if (!initialized || !user || !isAdmin(user.role))
    return <div className="min-h-screen grid place-items-center text-muted">Loading…</div>;

  const TABS: { key: Tab; label: string; icon: any; badge?: number; onClick?: () => void }[] = [
    { key: 'overview', label: 'Overview', icon: LineChart },
    { key: 'users', label: 'User Management', icon: Users },
    { key: 'activity', label: 'Recent User Activity', icon: Activity, badge: newLogins, onClick: openActivity },
    { key: 'chat', label: 'Support Chat', icon: MessageCircle },
    { key: 'kyc', label: 'KYC Verification', icon: Shield },
    { key: 'trades', label: 'Trade Approvals', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Admin Console</h1>
          <span className="text-xs px-2 py-1 rounded bg-bg-hover text-gold">{user.role}</span>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={t.onClick ?? (() => setTab(t.key))}
              className={cn('relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                tab === t.key ? 'bg-gold text-black font-medium' : 'text-muted hover:text-white')}>
              <t.icon size={16} /> {t.label}
              {!!t.badge && (
                <span className="ml-1 text-[10px] font-bold bg-down text-white rounded-full px-1.5 py-0.5">{t.badge} new</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab users={users} activity={activity} onlineMap={onlineMap} />}
        {tab === 'users' && <UsersTab users={users} onlineMap={onlineMap} canSuper={user.role === 'super_admin'} />}
        {tab === 'activity' && <ActivityTab activity={activity} onlineMap={onlineMap} />}
        {tab === 'chat' && <AdminChat />}
        {tab === 'kyc' && <AdminKYC />}
        {tab === 'trades' && <AdminTrades />}
      </main>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────
function OverviewTab({ users, activity, onlineMap }: { users: AppUser[]; activity: any[]; onlineMap: Record<string, boolean> }) {
  const onlineCount = Object.values(onlineMap).filter(Boolean).length;
  const admins = users.filter((u) => isAdmin(u.role)).length;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const newToday = users.filter((u) => (tsToDate(u.createdAt)?.getTime() ?? 0) >= startOfDay.getTime()).length;
  const loginsToday = activity.filter((a) => a.type === 'login' && (tsToDate(a.timestamp)?.getTime() ?? 0) >= startOfDay.getTime()).length;
  const failedToday = activity.filter((a) => a.type === 'failed_login' && (tsToDate(a.timestamp)?.getTime() ?? 0) >= startOfDay.getTime()).length;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat label="Total Users" value={users.length} />
      <Stat label="Online Now" value={onlineCount} accent />
      <Stat label="Admins" value={admins} />
      <Stat label="New Today" value={newToday} />
      <Stat label="Logins Today" value={loginsToday} />
      <Stat label="Failed Logins Today" value={failedToday} />
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────
function UsersTab({ users, onlineMap, canSuper }: { users: AppUser[]; onlineMap: Record<string, boolean>; canSuper: boolean }) {
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<AppUser | null>(null);
  const filtered = users.filter((u) =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || (u.displayName ?? '').toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="card p-4">
      <input className="input mb-4 max-w-sm" placeholder="Search users by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-muted text-left">
            <th className="p-2">User</th><th>Email</th><th>Role</th><th>Status</th><th className="text-right">Balance</th><th>Online</th><th>Last activity</th><th className="text-right">Manage</th>
          </tr></thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.uid} className="border-t border-border/50 hover:bg-bg-hover">
                <td className="p-2">{u.displayName ?? '—'}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td className={u.status === 'active' ? 'text-up' : 'text-down'}>{u.status}</td>
                <td className="text-right tabular-nums">{fmtUsd(u.balance)}</td>
                <td><OnlineDot on={onlineMap[u.uid]} /></td>
                <td className="text-xs text-muted">{tsToDate(u.lastActivity)?.toLocaleString() ?? '—'}</td>
                <td className="p-2 text-right"><button type="button" className="text-gold text-xs hover:underline" onClick={() => setEdit(u)}>Edit →</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted">No users found.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <UserEditModal user={edit} canSuper={canSuper} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ─── User Edit Modal ────────────────────────────────────────────
function UserEditModal({ user, canSuper, onClose }: { user: AppUser; canSuper: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ displayName: user.displayName ?? '', role: user.role, status: user.status, balance: Number(user.balance ?? 0) });
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    try { await adminUpdateUser(user.uid, form); setMsg('✓ Saved — pushed live to the user.'); }
    catch (e: any) { setMsg(e?.message ?? 'Save failed (check permissions).'); }
  };
  const fund = async (amt: number) => {
    try { await adminAdjustBalance(user.uid, amt); setForm((f) => ({ ...f, balance: f.balance + amt })); setMsg(`✓ Credited ${fmtUsd(amt)} live.`); }
    catch (e: any) { setMsg(e?.message ?? 'Update failed.'); }
  };
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div><h3 className="text-lg font-bold">{user.displayName ?? 'User'}</h3><p className="text-muted text-sm">{user.email}</p></div>
          <button type="button" className="text-muted hover:text-white" onClick={onClose}>✕</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Labeled label="Display name"><input className="input" aria-label="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Labeled>
          <Labeled label="Status">
            <select className="input" aria-label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
              <option value="active">active</option><option value="suspended">suspended</option>
            </select>
          </Labeled>
          <Labeled label="Role">
            <select className="input" aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
              <option value="user">user</option><option value="admin">admin</option>
              {canSuper && <option value="super_admin">super_admin</option>}
            </select>
          </Labeled>
          <Labeled label="Balance (USD)"><input className="input" type="number" aria-label="Balance" value={form.balance} onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })} /></Labeled>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" className="btn-ghost text-sm" onClick={() => fund(1000)}>+ $1,000</button>
          <button type="button" className="btn-ghost text-sm" onClick={() => fund(10000)}>+ $10,000</button>
        </div>
        <button type="button" className="btn-gold w-full mt-4" onClick={save}>Save changes</button>
        {msg && <p className="text-sm text-muted mt-2">{msg}</p>}
      </div>
    </div>
  );
}

// ─── Activity Tab ───────────────────────────────────────────────
function ActivityTab({ activity, onlineMap }: { activity: any[]; onlineMap: Record<string, boolean> }) {
  const label: Record<string, string> = { login: 'Login', logout: 'Logout', register: 'Registration', failed_login: 'Failed login' };
  const color: Record<string, string> = { login: 'text-up', logout: 'text-muted', register: 'text-gold', failed_login: 'text-down' };
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Recent User Activity</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-muted text-left">
            <th className="p-2">User</th><th>Email</th><th>Event</th><th>Status</th><th>IP</th><th>Device</th><th>Online</th><th className="text-right">Time</th>
          </tr></thead>
          <tbody>
            {activity.map((a) => (
              <tr key={a.id} className="border-t border-border/50">
                <td className="p-2">{a.username ?? '—'}</td>
                <td>{a.email}</td>
                <td className={color[a.type] ?? ''}>{label[a.type] ?? a.type}</td>
                <td className={a.status === 'failed' ? 'text-down' : 'text-up'}>{a.status}</td>
                <td className="text-xs text-muted">{a.ipAddress ?? '—'}</td>
                <td className="text-xs text-muted">{a.device ?? '—'}</td>
                <td>{a.uid ? <OnlineDot on={onlineMap[a.uid]} /> : <span className="text-muted text-xs">—</span>}</td>
                <td className="text-right text-xs text-muted">{tsToDate(a.timestamp)?.toLocaleString() ?? 'just now'}</td>
              </tr>
            ))}
            {activity.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted">No activity recorded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────
function OnlineDot({ on }: { on?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', on ? 'text-up' : 'text-muted')}>
      <Circle size={8} className={on ? 'fill-up text-up' : 'fill-muted text-muted'} /> {on ? 'Online' : 'Offline'}
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return <div className={cn('card p-5', accent && 'border-up/40')}><p className="text-xs text-muted">{label}</p><p className="text-2xl font-bold mt-1 tabular-nums">{value}</p></div>;
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-muted mb-1 block">{label}</span>{children}</label>;
}