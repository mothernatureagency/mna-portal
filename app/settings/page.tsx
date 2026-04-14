'use client';
import React, { useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import { TIMEZONE_OPTIONS } from '@/lib/timezone';

export default function SettingsPage() {
  const { activeClient, userEmail } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  const [timezone, setTimezone] = useState('America/Chicago');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [loadingGcal, setLoadingGcal] = useState(true);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const e = user?.email || '';
      setEmail(e);

      // Fetch user preferences
      if (e) {
        fetch(`/api/user-preferences?email=${encodeURIComponent(e)}`)
          .then(r => r.json())
          .then(data => {
            if (data.preferences?.timezone) {
              setTimezone(data.preferences.timezone);
            }
          })
          .catch(() => {});

        // Check Google Calendar status
        fetch(`/api/google/status?email=${encodeURIComponent(e)}`)
          .then(r => r.json())
          .then(data => setGcalConnected(!!data.connected))
          .catch(() => {})
          .finally(() => setLoadingGcal(false));
      }
    });
  }, []);

  async function saveTimezone(newTz: string) {
    setTimezone(newTz);
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/user-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, timezone: newTz }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  async function connectGoogleCalendar() {
    try {
      const res = await fetch(`/api/google/connect?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
  }

  async function disconnectGoogleCalendar() {
    try {
      await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setGcalConnected(false);
    } catch {}
  }

  const currentTzOption = TIMEZONE_OPTIONS.find(t => t.value === timezone);
  const now = new Date().toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your account preferences, timezone, and integrations</p>
      </div>

      {/* Account Info */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>person</span>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Account</h2>
            <p className="text-[12px] text-gray-400">{email || 'Loading...'}</p>
          </div>
        </div>
      </Card>

      {/* Timezone */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>schedule</span>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Timezone</h2>
            <p className="text-[12px] text-gray-400">Controls greetings, schedule display, and calendar events</p>
          </div>
        </div>

        <div className="space-y-3">
          <select
            value={timezone}
            onChange={(e) => saveTimezone(e.target.value)}
            className="w-full text-[13px] font-medium border rounded-xl px-4 py-3 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            style={{ border: '1px solid rgba(0,0,0,0.1)' }}
          >
            {TIMEZONE_OPTIONS.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-[12px]">
            <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 16 }}>public</span>
            <span className="text-gray-500">
              Current time in {currentTzOption?.short || timezone}: <span className="font-bold text-gray-700">{now}</span>
            </span>
            {saving && <span className="text-gray-400 ml-2">Saving...</span>}
            {saved && (
              <span className="text-emerald-600 font-semibold ml-2 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                Saved
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Google Calendar */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>calendar_month</span>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Google Calendar</h2>
            <p className="text-[12px] text-gray-400">Sync events between your schedule and Google Calendar</p>
          </div>
        </div>

        {loadingGcal ? (
          <div className="text-[12px] text-gray-400">Checking connection...</div>
        ) : gcalConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 18 }}>check_circle</span>
              <span className="text-[13px] font-semibold text-emerald-700">Google Calendar Connected</span>
            </div>
            <p className="text-[12px] text-gray-400">
              Events you create in the schedule or through the assistant will automatically sync to your Google Calendar.
            </p>
            <button
              onClick={disconnectGoogleCalendar}
              className="text-[12px] font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              Disconnect Google Calendar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 18 }}>link_off</span>
              <span className="text-[13px] font-medium text-gray-500">Not connected</span>
            </div>
            <p className="text-[12px] text-gray-400">
              Connect your Google Calendar to automatically sync meetings, tasks, and events created in the portal.
            </p>
            <button
              onClick={connectGoogleCalendar}
              className="inline-flex items-center gap-2 text-[13px] font-semibold px-5 py-2.5 rounded-xl text-white transition-colors"
              style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>link</span>
              Connect Google Calendar
            </button>
          </div>
        )}
      </Card>

      {/* Notifications info */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Notifications</h2>
            <p className="text-[12px] text-gray-400">Email digests and alerts</p>
          </div>
        </div>
        <div className="text-[12px] text-gray-500">
          Daily briefing emails are sent via your Make.com automation. Contact your admin to adjust email frequency or recipients.
        </div>
      </Card>
    </div>
  );
}
