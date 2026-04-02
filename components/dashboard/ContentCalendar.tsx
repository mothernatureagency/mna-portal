'use client';
import React, { useState } from 'react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Post = { platform: string; type: string; topic: string; color: string };
type DayEntry = { date: number; dayOfWeek: string; posts: Post[] };
type MonthMap = { [key: string]: DayEntry[] };
type CaptionMap = { [key: string]: string };

const DATA: MonthMap = {
  '2026-3': [
    { dayOfWeek: 'Mon', date: 6, posts: [{ platform: 'IG', type: 'Reel', topic: 'Before/After', color: '#e879f9' }] },
    { dayOfWeek: 'Tue', date: 7, posts: [{ platform: 'FB', type: 'Post', topic: 'Client Results', color: '#3b82f6' }] },
    { dayOfWeek: 'Wed', date: 8, posts: [{ platform: 'Blog', type: 'Article', topic: 'IV Therapy Guide', color: '#10b981' }] },
    { dayOfWeek: 'Wed', date: 8, posts: [{ platform: 'IG', type: 'Story', topic: 'Day in the Life', color: '#e879f9' }] },
    { dayOfWeek: 'Thu', date: 9, posts: [{ platform: 'Email', type: 'Newsletter', topic: 'April Promo', color: '#f59e0b' }] },
    { dayOfWeek: 'Fri', date: 10, posts: [{ platform: 'IG', type: 'Carousel', topic: 'Top 5 Benefits', color: '#e879f9' }, { platform: 'TT', type: 'Video', topic: 'Trending Audio', color: '#06b6d4' }] },
    { dayOfWeek: 'Sun', date: 12, posts: [] },
    { dayOfWeek: 'Mon', date: 13, posts: [{ platform: 'FB', type: 'Post', topic: 'Weekly Recap', color: '#3b82f6' }] },
  ],
};

export default function ContentCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [captions, setCaptions] = useState({} as CaptionMap);

  const key = year + '-' + month;
  const entries = DATA[key] || [];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const postsByDate: { [d: number]: Post[] } = {};
  for (const e of entries) {
    if (!postsByDate[e.date]) postsByDate[e.date] = [];
    postsByDate[e.date].push(...e.posts);
  }

  const prevMonth = function() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = function() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return React.createElement('div', { style: { background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 24 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 } },
      React.createElement('h2', { style: { color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 } }, 'Content Calendar'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement('button', { onClick: prevMonth, style: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 16 } }, '<'),
        React.createElement('span', { style: { color: '#fff', fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: 'center' } }, MONTH_NAMES[month] + ' ' + year),
        React.createElement('button', { onClick: nextMonth, style: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 16 } }, '>'),
        React.createElement('button', { style: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 12 } }, '+ Add Post')
      )
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 } },
      ...DAYS.map(function(d) {
        return React.createElement('div', { key: d, style: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textAlign: 'center', padding: '4px 0' } }, d);
      })
    ),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 } },
      ...cells.map(function(date, i) {
        if (date === null) {
          return React.createElement('div', { key: 'empty-' + i, style: { minHeight: 64, borderRadius: 8, background: 'rgba(255,255,255,0.02)' } });
        }
        const posts = postsByDate[date] || [];
        const isToday = date === now.getDate() && month === now.getMonth() && year === now.getFullYear();
        return React.createElement('div', { key: date, style: { minHeight: 64, borderRadius: 8, background: isToday ? 'rgba(99,179,237,0.15)' : 'rgba(255,255,255,0.04)', border: isToday ? '1px solid rgba(99,179,237,0.4)' : '1px solid rgba(255,255,255,0.06)', padding: '6px 6px 4px' } },
          React.createElement('div', { style: { color: isToday ? '#63b3ed' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, marginBottom: 4 } }, date),
          ...posts.map(function(p, pi) {
            return React.createElement('div', { key: pi, style: { background: p.color + '22', border: '1px solid ' + p.color + '55', borderRadius: 4, padding: '2px 4px', marginBottom: 2, fontSize: 9, color: '#fff', lineHeight: 1.3 } },
              React.createElement('span', { style: { opacity: 0.7 } }, p.platform + ' '),
              React.createElement('span', null, p.type)
            );
          })
        );
      })
    )
  );
}
