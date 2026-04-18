'use client';

import React, { useEffect, useState } from 'react';

type Slot = { start: string; end: string; available: boolean };

export default function PublicBookingPage() {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingMode, setMeetingMode] = useState<'google_meet' | 'in_person'>('google_meet');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [error, setError] = useState('');

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().slice(0, 10);
  });

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
    if (!selectedSlot || !name.trim() || !email.trim() || !title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: email.trim(),
          requesterName: name.trim(),
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
        setConfirmation(data);
        setStep(4);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Failed to book. Please try again.');
    }
    setSubmitting(false);
  }

  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return (
    <main className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #0d1b2a 100%)' }}>
      <div className="max-w-xl mx-auto px-5 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logos/mna-icon-transparent.png" alt="Mother Nature Agency" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Book a Meeting</h1>
          <p className="text-white/40 text-sm mt-1">Schedule a time with Mother Nature Agency</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= s ? 'text-white' : 'text-white/30'
                }`}
                style={{ background: step >= s ? 'linear-gradient(135deg, #0c6da4, #4ab8ce)' : 'rgba(255,255,255,0.06)' }}
              >
                {step > s ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span> : s}
              </div>
              {s < 4 && <div className={`w-8 h-0.5 rounded ${step > s ? 'bg-cyan-400/40' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Date */}
        {step === 1 && (
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 className="text-lg font-bold text-white mb-4">Select a Date</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {dates.map(d => {
                const dateObj = new Date(d + 'T12:00:00');
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                const isSelected = d === selectedDate;
                return (
                  <button
                    key={d}
                    onClick={() => { if (!isWeekend) { setSelectedDate(d); setStep(2); } }}
                    disabled={isWeekend}
                    className={`rounded-xl px-3 py-3 text-center transition-all ${
                      isWeekend ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'
                    }`}
                    style={{
                      background: isSelected ? 'rgba(12,109,164,0.2)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid rgba(74,184,206,0.4)' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="text-[10px] text-white/40 font-bold uppercase">{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-lg font-bold text-white/70">{dateObj.getDate()}</div>
                    <div className="text-[10px] text-white/30">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Time */}
        {step === 2 && (
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Select a Time</h2>
              <button onClick={() => setStep(1)} className="text-sm text-white/40 hover:text-white/60 transition-colors">Change date</button>
            </div>
            <p className="text-white/40 text-sm mb-4">{formatDate(selectedDate)}</p>
            {loadingSlots ? (
              <div className="text-white/40 text-sm text-center py-8">Checking availability...</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.filter(s => s.available).map(slot => (
                  <button
                    key={slot.start}
                    onClick={() => { setSelectedSlot(slot); setStep(3); }}
                    className="rounded-xl px-3 py-3 text-sm font-semibold text-white/60 hover:text-white transition-all hover:bg-white/5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {formatTime(slot.start)}
                  </button>
                ))}
                {slots.filter(s => s.available).length === 0 && (
                  <div className="col-span-full text-white/30 text-sm text-center py-6">No available times on this date</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && selectedSlot && (
          <div className="rounded-2xl p-6 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Your Details</h2>
              <button onClick={() => setStep(2)} className="text-sm text-white/40 hover:text-white/60 transition-colors">Change time</button>
            </div>

            <div className="text-sm text-white/50 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
              {formatDate(selectedDate)} at {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
            </div>

            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-sm px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40 transition-colors"
            />
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full text-sm px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 focus:border-cyan-400/40 transition-colors"
            />
            <input
              type="text"
              placeholder="Meeting topic (e.g. Marketing consultation)"
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

            {error && <p className="text-red-400 text-sm text-center bg-red-400/10 rounded-xl py-2 px-3">{error}</p>}

            <button
              onClick={handleBook}
              disabled={!name.trim() || !email.trim() || !title.trim() || submitting}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
            >
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && confirmation && (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}>
              <span className="material-symbols-outlined text-white" style={{ fontSize: 32 }}>check</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Meeting Confirmed!</h2>
            <p className="text-white/50 text-sm mb-6">A calendar invite has been sent to {email}.</p>

            <div className="text-left space-y-3 mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Meeting</span>
                <span className="text-white font-semibold">{title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Date</span>
                <span className="text-white font-semibold">{selectedDate && formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Time</span>
                <span className="text-white font-semibold">{selectedSlot && `${formatTime(selectedSlot.start)} - ${formatTime(selectedSlot.end)}`}</span>
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
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/20 text-xs">Powered by Mother Nature Agency</p>
        </div>
      </div>
    </main>
  );
}
