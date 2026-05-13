/**
 * NotificationBell.jsx — Sprint 10
 *
 * A self-contained header notification bell:
 *  - Shows unread badge count
 *  - Opens a dropdown panel listing recent notifications
 *  - Mark individual or all as read
 *  - Polls /api/notifications/history every 60 s for new items
 *
 * Usage: <NotificationBell /> in the app header
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';
const POLL_INTERVAL_MS = 60_000;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

const TYPE_STYLES = {
  info:               'bg-blue-50  text-blue-700',
  warning:            'bg-amber-50 text-amber-700',
  error:              'bg-red-50   text-red-700',
  success:            'bg-green-50 text-green-600',
  screen_offline:     'bg-red-50   text-red-700',
  campaign_completed: 'bg-green-50 text-green-600',
  low_balance:        'bg-amber-50 text-amber-700',
  new_earnings:       'bg-blue-50  text-blue-700',
};

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen]               = useState(false);
  const [items, setItems]             = useState([]);
  const [unread, setUnread]           = useState(0);
  const [loading, setLoading]         = useState(true);
  const [markingAll, setMarkingAll]   = useState(false);
  const panelRef = useRef(null);
  const btnRef   = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/notifications/history?limit=20`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnread((data.notifications || []).filter(n => !n.read).length);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function onDown(e) {
      if (open && panelRef.current && !panelRef.current.contains(e.target) && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function markOne(id) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
    await fetch(`${API}/api/notifications/mark-read`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ id }),
    });
  }

  async function markAll() {
    setMarkingAll(true);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    await fetch(`${API}/api/notifications/mark-read`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    setMarkingAll(false);
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-100 shadow-lg z-50 overflow-hidden"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={markingAll}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-200 mt-1.5 shrink-0 animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">You're all caught up ✓</div>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 flex gap-3 cursor-pointer transition-colors ${
                    n.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/40 hover:bg-blue-50'
                  }`}
                  onClick={() => !n.read && markOne(n.id)}
                >
                  <span className={`mt-1 shrink-0 w-2 h-2 rounded-full ${
                    n.read ? 'bg-gray-200' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        TYPE_STYLES[n.type] || TYPE_STYLES.info
                      }`}>{n.type?.replace('_', ' ')}</span>
                      <span className="text-[10px] text-gray-400">{timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
