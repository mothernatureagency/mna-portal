'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Slot = { start: string; end: string; available: boolean };

export default function ClientBookingPage() {
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingMode, setMeetingMode] = useState<'google_meet' | 'in_person'>('google_meet');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ meetLink: string | null; title: string; date: string; time: string } | null>(null);

  // Get next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1); // start from tomorrow
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || '');
      const meta = user?.user_metadata || {};
      const name = (meta.full_name as string) || (meta.name as string) || user?.email?.split('@')[0] || '';
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
    });
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/booking/slots?date=${selectedDate}`)
      .then(r => r.json())
      .then(data => setSlots(data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate]);

  async function handleBook() {
    if (!selectedSlot || !title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: userEmail,
          requesterName: userName,
          date: selectedDate,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          title: title.trim(),
          description: description.trim() || null,
          meetingMode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmation({
          meetLink: data.meetLink,
          title: title.trim(),
          date: selectedDate,
          time: `${selectedSlot.start} - ${selectedSlot.end}`,
        });
      }
    } catch {}
    setSubmitting(false);
  }

  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Confirmation screen
  if (confirmation) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: 32 }}>check</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Meeting Booked!</h2>
          <p className="text-white/50 text-sm mb-6">A calendar invite has been sent to your email.</p>

          <div className="text-left space-y-3 mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Meeting</span>
              <span className="text-white font-semibold">{confirmation.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Date</span>
              <span className="text-white font-semibold">{formatDate(confirmation.date)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Time</span>
              <span className="text-white font-semibold">{confirmation.time}</span>
            </div>
          </div>

          {confirmation.meetLink && (
            <a
              href={confirmation.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>videocam</span>
              Join Google Meet
            </a>
          )}

          <button
            onClick={() => { setConfirmation(null); setSelectedDate(''); setSelectedSlot(null); setTitle(''); setDescription(''); }}
            className="block mx-auto mt-4 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Book another meeting
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Book a Meeting</h1>
        <p className="text-sm text-white/40 mt-1">Select a date and time to schedule a meeting with Mother Nature Agency.</p>
      </div>

      {/* Step 1: Date Selection */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 18 }}>calendar_month</span>
          <span className="text-sm font-bold text-white">Select a Date</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
          {dates.map(d => {
            const dateObj = new Date(d + 'T12:00:00');
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            const isSelected = d === selectedDate;
            return (
              <button
                key={d}
                onClick={() => !isWeekend && setSelectedDate(d)}
                disabled={isWeekend}
                className={`rounded-xl px-3 py-3 text-center transition-all ${
                  isWeekend ? 'opacity-30 cursor-not-allowed' :
                  isSelected ? 'ring-2 ring-cyan-400' : 'hover:bg-white/5'
                }`}
                style={{
                  background: isSelected ? 'rgba(12,109,164,0.2)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? '1px solid rgba(74,184,206,0.4)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="text-[10px] text-white/40 font-bold uppercase">{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className={`text-lg font-bold ${isSelected ? 'text-cyan-400' : 'text-white/70'}`}>{dateObj.getDate()}</div>
                <div className="text-[10px] text-white/30">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Time Slots */}
      {selectedDate && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 18 }}>schedule</span>
            <span className="text-sm font-bold text-white">Available Times — {formatDate(selectedDate)}</span>
          </div>
          {loadingSlots ? (
            <div className="text-white/40 text-sm text-center py-6">Checking availability...</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {slots.filter(s => s.available).map(slot => {
                const isSelected = selectedSlot?.start === slot.start;
                return (
                  <button
                    key={slot.start}
                    onClick={() => setSelectedSlot(slot)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                      isSelected ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                    style={{
                      background: isSelected ? 'linear-gradient(135deg, #0c6da4, #4ab8ce)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {formatTime(slot.start)}
                  </button>
                );
              })}
              {slots.filter(s => s.available).length === 0 && (
                <div className="col-span-full text-white/30 text-sm text-center py-4">No available times on this date</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Meeting Details */}
      {selectedSlot && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: 18 }}>edit_note</span>
            <span className="text-sm font-bold text-white">Meeting Details</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-white/50 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event</span>
            {formatDate(selectedDate)} at {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
          </div>

          <input
            type="text"
            placeholder="Meeting topic (e.g. Marketing strategy discussion)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-sm px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40 transition-colors"
          />

          <textarea
            placeholder="Additional notes (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full text-sm px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40 transition-colors resize-none"
          />

          {/* Meeting mode */}
          <div className="flex gap-2">
            <button
              onClick={() => setMeetingMode('google_meet')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors ${
                meetingMode === 'google_meet'
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border-white/15 text-white/50'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
              Google Meet
            </button>
            <button
              onClick={() => setMeetingMode('in_person')}
              className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-colors ${
                meetingMode === 'in_person'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/15 text-white/50'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>
              In-Person
            </button>
          </div>

          <button
            onClick={handleBook}
            disabled={!title.trim() || submitting}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            {submitting ? 'Booking...' : 'Confirm Booking'}
          </button>
        </div>
      )}
    </div>
  );
}
