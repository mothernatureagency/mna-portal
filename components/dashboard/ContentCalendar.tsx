'use client';
import React from 'react';
import Card from '@/components/ui/Card';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const calendar = [
  { day: 'Mon', date: 31, posts: [{ platform: 'IG', type: 'Reel', topic: 'Before/After', color: '#e879f9' }] },
  { day: 'Tue', date: 1, posts: [{ platform: 'FB', type: 'Post', topic: 'Client Results', color: '#3b82f6' }, { platform: 'Blog', type: 'Article', topic: 'IV Therapy Guide', color: '#10b981' }] },
  { day: 'Wed', date: 2, posts: [{ platform: 'IG', type: 'Story', topic: 'Day in the Life', color: '#e879f9' }] },
  { day: 'Thu', date: 3, posts: [{ platform: 'Email', type: 'Newsletter', topic: 'April Promo', color: '#f59e0b' }] },
  { day: 'Fri', date: 4, posts: [{ platform: 'IG', type: 'Carousel', topic: 'Top 5 Benefits', color: '#e879f9' }, { platform: 'TT', type: 'Video', topic: 'Trending Audio', color: '#111827' }] },
  { day: 'Sat', date: 5, posts: [] },
  { day: 'Sun', date: 6, posts: [{ platform: 'FB', type: 'Post', topic: 'Weekly Recap', color: '#3b82f6' }] },
];

const trends = [
  { tag: '#WellnessTrends2026', volume: '2.4M', fit: 'High', idea: 'How IV therapy fits the 2026 wellness movement' },
  { tag: '#NaturoPath', volume: '890K', fit: 'High', idea: 'What makes natural healing so effective — explainer reel' },
  { tag: '#MomBossLife', volume: '1.1M', fit: 'Medium', idea: 'Running a wellness business as a mom — behind the scenes' },
  { tag: '#AntiAgingSecrets', volume: '3.2M', fit: 'High', idea: 'The science behind IV anti-aging treatments' },
];

export default function ContentCalendar() {
  return (
    <div className="flex flex-col gap-5">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Content Calendar</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">April 2026 · AI-planned schedule</p>
          </div>
          <button className="text-[12px] font-semibold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600">
            + Add Post
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {calendar.map((d) => (
            <div key={d.day}>
              <div className="text-center mb-2">
                <div className="text-[9px] font-bold uppercase text-gray-400">{d.day}</div>
                <div className="text-[13px] font-black text-gray-700">{d.date}</div>
              </div>
              <div className="flex flex-col gap-1.5" style={{ minHeight: 80 }}>
                {d.posts.map((p, i) => (
                  <div key={i} className="rounded-lg p-1.5" style={{ background: p.color + '15', borderLeft: `2px solid ${p.color}` }}>
                    <div className="text-[8px] font-bold" style={{ color: p.color }}>{p.platform} · {p.type}</div>
                    <div className="text-[9px] text-gray-600 mt-0.5 leading-tight">{p.topic}</div>
                  </div>
                ))}
                {d.posts.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 flex items-center justify-center" style={{ minHeight: 48 }}>
                    <span className="text-[9px] text-gray-300">empty</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="text-[15px] font-bold text-gray-900 tracking-tight mb-1">AI Trend Ideas</h3>
        <p className="text-[11px] text-gray-400 mb-4">Trending topics matched to your brand</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {trends.map((t, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black text-blue-500">{t.tag}</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.fit === 'High' ? '#dcfce7' : '#fef9c3', color: t.fit === 'High' ? '#16a34a' : '#ca8a04' }}>{t.fit} Fit</span>
              </div>
              <div className="text-[10px] text-gray-400 mb-2">{t.volume} posts this week</div>
              <div className="text-[11px] text-gray-700 font-medium">{t.idea}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
