'use client';
import React, { useState } from 'react';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

interface DayPost {
      platform: string;
      type: string;
      topic: string;
      color: string;
}

interface CalendarDay {
      date: number;
      dayOfWeek: string;
      posts: DayPost[];
}

const calendarData: Record<string, CalendarDay[]> = {
      '2026-2': [
          { dayOfWeek: 'Mon', date: 2, posts: [{ platform: 'IG', type: 'Reel', topic: 'March Preview', color: '#e879f9' }] },
          { dayOfWeek: 'Wed', date: 4, posts: [{ platform: 'FB', type: 'Post', topic: 'March Coming Soon', color: '#3b82f6' }] },
          { dayOfWeek: 'Fri', date: 27, posts: [{ platform: 'Email', type: 'Newsletter', topic: 'Month Recap', color: '#f59e0b' }] },
            ],
      '2026-3': [
          { dayOfWeek: 'Mon', date: 6, posts: [{ platform: 'IG', type: 'Reel', topic: 'Before/After', color: '#e879f9' }] },
          { dayOfWeek: 'Tue', date: 7, posts: [{ platform: 'FB', type: 'Post', topic: 'Client Results', color: '#3b82f6' }] },
          { dayOfWeek: 'Wed', date: 8, posts: [{ platform: 'IG', type: 'Story', topic: 'Day in the Life', color: '#e879f9' }] },
          { dayOfWeek: 'Thu', date: 9, posts: [{ platform: 'Email', type: 'Newsletter', topic: 'April Promo', color: '#f59e0b' }] },
          { dayOfWeek: 'Fri', date: 10, posts: [{ platform: 'IG', type: 'Carousel', topic: 'Top 5 Benefits', color: '#e879f9' }] },
          { dayOfWeek: 'Mon', date: 13, posts: [{ platform: 'TT', type: 'Video', topic: 'Trend Sound', color: '#06b6d4' }] },
          { dayOfWeek: 'Tue', date: 14, posts: [{ platform: 'IG', type: 'Post', topic: 'Testimonial', color: '#e879f9' }] },
          { dayOfWeek: 'Wed', date: 15, posts: [{ platform: 'FB', type: 'Post', topic: 'Mid-Month Tips', color: '#3b82f6' }] },
          { dayOfWeek: 'Thu', date: 16, posts: [{ platform: 'IG', type: 'Reel', topic: 'Product Spotlight', color: '#e879f9' }] },
          { dayOfWeek: 'Fri', date: 17, posts: [{ platform: 'Email', type: 'Promo', topic: 'Weekend Deal', color: '#f59e0b' }] },
          { dayOfWeek: 'Mon', date: 20, posts: [{ platform: 'IG', type: 'Story', topic: 'Behind Scenes', color: '#e879f9' }] },
          { dayOfWeek: 'Tue', date: 21, posts: [{ platform: 'TT', type: 'Video', topic: 'How-To Tutorial', color: '#06b6d4' }] },
          { dayOfWeek: 'Wed', date: 22, posts: [{ platform: 'FB', type: 'Post', topic: 'Earth Day', color: '#3b82f6' }] },
          { dayOfWeek: 'Thu', date: 23, posts: [{ platform: 'IG', type: 'Carousel', topic: 'Spring Collection', color: '#e879f9' }] },
          { dayOfWeek: 'Fri', date: 24, posts: [{ platform: 'Email', type: 'Newsletter', topic: 'Weekly Wrap', color: '#f59e0b' }] },
          { dayOfWeek: 'Mon', date: 27, posts: [{ platform: 'IG', type: 'Reel', topic: 'Monday Motivation', color: '#e879f9' }] },
          { dayOfWeek: 'Tue', date: 28, posts: [{ platform: 'FB', type: 'Post', topic: 'Client Feature', color: '#3b82f6' }] },
          { dayOfWeek: 'Wed', date: 29, posts: [{ platform: 'IG', type: 'Story', topic: 'Q&A Session', color: '#e879f9' }] },
          { dayOfWeek: 'Thu', date: 30, posts: [{ platform: 'TT', type: 'Video', topic: 'Trending Audio', color: '#06b6d4' }] },
            ],
      '2026-4': [
          { dayOfWeek: 'Fri', date: 1, posts: [{ platform: 'IG', type: 'Reel', topic: 'May Launch', color: '#e879f9' }] },
          { dayOfWeek: 'Mon', date: 4, posts: [{ platform: 'Email', type: 'Newsletter', topic: 'May Kickoff', color: '#f59e0b' }] },
          { dayOfWeek: 'Wed', date: 6, posts: [{ platform: 'FB', type: 'Post', topic: 'Spring Promo', color: '#3b82f6' }] },
          { dayOfWeek: 'Mon', date: 11, posts: [{ platform: 'TT', type: 'Video', topic: 'Wellness Tips', color: '#06b6d4' }] },
          { dayOfWeek: 'Wed', date: 13, posts: [{ platform: 'IG', type: 'Carousel', topic: 'Summer Prep', color: '#e879f9' }] },
          { dayOfWeek: 'Fri', date: 15, posts: [{ platform: 'Email', type: 'Promo', topic: 'Mid-Month Sale', color: '#f59e0b' }] },
          { dayOfWeek: 'Mon', date: 18, posts: [{ platform: 'IG', type: 'Reel', topic: 'Transformation', color: '#e879f9' }] },
          { dayOfWeek: 'Wed', date: 20, posts: [{ platform: 'FB', type: 'Post', topic: 'Community Feature', color: '#3b82f6' }] },
          { dayOfWeek: 'Fri', date: 22, posts: [{ platform: 'IG', type: 'Story', topic: 'Weekend Giveaway', color: '#e879f9' }] },
          { dayOfWeek: 'Wed', date: 27, posts: [{ platform: 'Email', type: 'Newsletter', topic: 'End of Month', color: '#f59e0b' }] },
          { dayOfWeek: 'Fri', date: 29, posts: [{ platform: 'IG', type: 'Carousel', topic: 'Monthly Roundup', color: '#e879f9' }] },
            ],
};

export default function ContentCalendar() {
      const [year, setYear] = useState(2026);
      const [month, setMonth] = useState(3);
      const [captions, setCaptions] = useState<Record<string, string>>({});

  const monthKey = year + '-' + month;
      const monthDays = calendarData[monthKey] || [];

  function prevMonth() {
          if (month === 0) {
                    setMonth(11);
                    setYear(year - 1);
          } else {
                    setMonth(month - 1);
          }
  }

  function nextMonth() {
          if (month === 11) {
                    setMonth(0);
                    setYear(year + 1);
          } else {
                    setMonth(month + 1);
          }
  }

  function handleCaption(key: string, val: string) {
          setCaptions(function(prev) {
                    const next = Object.assign({}, prev);
                    next[key] = val;
                    return next;
          });
  }

  return (
          <div style={{
                    background: 'linear-gradient(135deg, rgba(14,47,68,0.95) 0%, rgba(21,74,103,0.9) 100%)',
                    border: '1px solid rgba(121,169,209,0.2)',
                    borderRadius: '16px',
                    padding: '24px',
          }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <div>
                                          <h2 style={{ color: '#F4FBFF', fontSize: '18px', fontWeight: 600, margin: 0 }}>Content Calendar</h2>h2>
                                          <p style={{ color: '#6E93A8', fontSize: '13px', margin: '4px 0 0 0' }}>Plan and schedule your content</p>p>
                                </div>div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <button onClick={prevMonth} style={{ background: 'rgba(121,169,209,0.15)', border: '1px solid rgba(121,169,209,0.3)', borderRadius: '8px', color: '#79A9D1', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          {'\u2039'}
                                      </button>button>
                                      <span style={{ color: '#F4FBFF', fontSize: '15px', fontWeight: 600, minWidth: '150px', textAlign: 'center' }}>
                                          {MONTHS[month]} {year}
                                      </span>span>
                                      <button onClick={nextMonth} style={{ background: 'rgba(121,169,209,0.15)', border: '1px solid rgba(121,169,209,0.3)', borderRadius: '8px', color: '#79A9D1', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          {'\u203a'}
                                      </button>button>
                            </div>div>
                    </div>div>
          
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                    {DAYS_OF_WEEK.map(function(d) {
                        return (
                                        <div key={d} style={{ textAlign: 'center', color: '#6E93A8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: '8px', borderBottom: '1px solid rgba(121,169,209,0.15)', marginBottom: '8px' }}>
                                            {d}
                                        </div>div>
                                      );
          })}
                
                    {DAYS_OF_WEEK.map(function(dayName) {
                        const entries = monthDays.filter(function(d) { return d.dayOfWeek === dayName; });
                        const capKey = monthKey + '-' + dayName;
                        return (
                                        <div key={dayName} style={{ background: 'rgba(7,28,42,0.4)', border: '1px solid rgba(121,169,209,0.12)', borderRadius: '10px', padding: '10px', minHeight: '160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {entries.length === 0 ? (
                                                            <div style={{ color: '#6E93A8', fontSize: '11px', textAlign: 'center', paddingTop: '16px', opacity: 0.4 }}>
                                                                              No posts
                                                            </div>div>
                                                          ) : entries.map(function(entry, i) {
                                                            const postColor = entry.posts[0] ? entry.posts[0].color : '#79A9D1';
                                                            return (
                                                                                  <div key={i}>
                                                                                                      <div style={{ fontSize: '10px', color: '#B8D3E4', fontWeight: 600, marginBottom: '2px' }}>{entry.date}</div>div>
                                                                                                      <div style={{ background: postColor + '22', border: '1px solid ' + postColor + '44', borderRadius: '6px', padding: '4px 6px', marginBottom: '4px' }}>
                                                                                                                            <div style={{ fontSize: '10px', fontWeight: 700, color: postColor }}>
                                                                                                                                {entry.posts[0] ? entry.posts[0].platform : ''} {'\u00b7'} {entry.posts[0] ? entry.posts[0].type : ''}
                                                                                                                                </div>div>
                                                                                                                            <div style={{ fontSize: '10px', color: '#B8D3E4', marginTop: '2px', lineHeight: '1.3' }}>
                                                                                                                                {entry.posts[0] ? entry.posts[0].topic : ''}
                                                                                                                                </div>div>
                                                                                                          </div>div>
                                                                                      </div>div>
                                                                                );
                                        })}
                                                      <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                                                                      <div style={{ fontSize: '9px', color: '#6E93A8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                                                                                        Caption
                                                                      </div>div>
                                                                      <textarea
                                                                                            value={captions[capKey] || ''}
                                                                                            onChange={function(e) { handleCaption(capKey, e.target.value); }}
                                                                                            placeholder="Write caption..."
                                                                                            style={{ width: '100%', background: 'rgba(121,169,209,0.06)', border: '1px solid rgba(121,169,209,0.2)', borderRadius: '6px', color: '#B8D3E4', fontSize: '10px', padding: '6px', resize: 'vertical', minHeight: '52px', outline: 'none', fontFamily: 'inherit', lineHeight: '1.4', boxSizing: 'border-box' }}
                                                                                          />
                                                      </div>div>
                                        </div>div>
                                      );
          })}
                </div>div>
          
                <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
                    {[
              { label: 'Instagram', color: '#e879f9' },
              { label: 'Facebook', color: '#3b82f6' },
              { label: 'TikTok', color: '#06b6d4' },
              { label: 'Email', color: '#f59e0b' },
                      ].map(function(item) {
                                    return (
                                                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                                                                  <span style={{ color: '#6E93A8', fontSize: '11px' }}>{item.label}</span>span>
                                                    </div>div>
                                                  );
                      })}
                </div>div>
          </div>div>
        );
}</div>
