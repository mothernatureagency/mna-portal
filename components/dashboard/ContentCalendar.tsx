'use client';
import React from 'react';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';

type Post = { platform: string; type: string; color: string };
type CalDay = { d: string; posts?: Post[] };

const calDays: CalDay[] = [
  { d: '31' },
  { d: '1', posts: [{ platform: 'IG', type: 'Reel', color: '#ec4899' }] },
  { d: '2', posts: [{ platform: 'FB', type: 'Post', color: '#3b82f6' }] },
  { d: '3', posts: [{ platform: 'TT', type: 'Video', color: '#111827' }] },
  { d: '4', posts: [{ platform: 'LI', type: 'Article', color: '#0a66c2' }] },
  { d: '5' }, { d: '6' },
  { d: '7', posts: [{ platform: 'IG', type: 'Reel', color: '#ec4899' }, { platform: 'TT', type: 'Video', color: '#111827' }] },
  { d: '8', posts: [{ platform: 'FB', type: 'Post', color: '#3b82f6' }] },
  { d: '9', posts: [{ platform: 'LI', type: 'Article', color: '#0a66c2' }] },
  { d: '10', posts: [{ platform: 'IG', type: 'Story', color: '#ec4899' }] },
  { d: '11', posts: [{ platform: 'TT', type: 'Video', color: '#111827' }, { platform: 'FB', type: 'Post', color: '#3b82f6' }] },
  { d: '12' }, { d: '13' },
  { d: '14', posts: [{ platform: 'IG', type: 'Reel', color: '#ec4899' }, { platform: 'LI', type: 'Article', color: '#0a66c2' }] },
  { d: '15', posts: [{ platform: 'FB', type: 'Post', color: '#3b82f6' }] },
  { d: '16', posts: [{ platform: 'TT', type: 'Video', color: '#111827' }] },
  { d: '17', posts: [{ platform: 'IG', type: 'Story', color: '#ec4899' }] },
  { d: '18', posts: [{ platform: 'LI', type: 'Article', color: '#0a66c2' }, { platform: 'TT', type: 'Video', color: '#111827' }] },
  { d: '19' }, { d: '20' },
  { d: '21', posts: [{ platform: 'IG', type: 'Reel', color: '#ec4899' }] },
  ];

const trendIdeas = [
  { tag: '#TikTokHealth', trend: '↑ 340% this week', idea: 'Before & after transformation — client result with AI voiceover overlay', platform: 'TikTok', platformColor: '#111827', priority: 'Hot 🔥' },
  { tag: '#WellnessWednesday', trend: '↑ 180% this week', idea: '5 signs your body needs IV therapy — carousel with stats', platform: 'Instagram', platformColor: '#ec4899', priority: 'Hot 🔥' },
  { tag: '#MedSpaMarketing', trend: '↑ 95% this month', idea: 'Behind the scenes: how we built 3x ROI in 90 days for a client', platform: 'LinkedIn', platformColor: '#0a66c2', priority: 'Trending' },
  { tag: '#HealthTech2026', trend: '↑ 220% this month', idea: 'AI in aesthetics — what clients actually want to know', platform: 'Facebook', platformColor: '#3b82f6', priority: 'Trending' },
  { tag: '#SpringWellness', trend: '↑ 410% seasonal', idea: 'Spring refresh campaign — limited-time offer hook reel', platform: 'Instagram', platformColor: '#ec4899', priority: 'Seasonal 🌱' },
  ];

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const legend = [
  { label: 'Instagram', color: '#ec4899' },
  { label: 'Facebook', color: '#3b82f6' },
  { label: 'TikTok', color: '#111827' },
  { label: 'LinkedIn', color: '#0a66c2' },
  ];

export default function ContentCalendar() {
    const { activeClient } = useClient();
    const { gradientFrom, gradientTo } = activeClient.branding;

  return (
        <div className="grid gap-5" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
          {/* Calendar */}
                <Card className="p-6">
                        <div className="flex items-start justify-between mb-4">
                                  <div>
                                              <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">📅 Content Calendar — April 2026</h3>h3>
                                              <p className="text-[11px] text-gray-400 mt-0.5">Scheduled posts across all platforms</p>p>
                                  </div>div>
                                  <button
                                                className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white"
                                                style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
                                              >
                                              + Add Post
                                  </button>button>
                        </div>div>
                
                  {/* Day headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                          {weekDays.map((d) => (
                      <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af', padding: '4px 0' }}>{d}</div>div>
                    ))}
                        </div>div>
                
                  {/* Calendar grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                          {calDays.map((day, i) => (
                      <div
                                      key={i}
                                      style={{
                                                        minHeight: 52,
                                                        background: day.posts && day.posts.length > 0 ? '#f0f9ff' : '#fafafa',
                                                        border: `1px solid ${day.posts && day.posts.length > 0 ? '#dbeafe' : '#f3f4f6'}`,
                                                        borderRadius: 8,
                                                        padding: 4,
                                      }}
                                    >
                                    <div style={{ fontSize: 10, fontWeight: 600, color: '#374151', marginBottom: 2 }}>{day.d}</div>div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      {(day.posts || []).map((p, j) => (
                                                        <div key={j} style={{ background: p.color, color: 'white', borderRadius: 4, padding: '1px 4px', fontSize: 8, fontWeight: 700, textAlign: 'center' }}>
                                                          {p.platform} {p.type}
                                                        </div>div>
                                                      ))}
                                    </div>div>
                      </div>div>
                    ))}
                        </div>div>
                
                  {/* Legend */}
                        <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                          {legend.map((l) => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 10, color: '#6b7280' }}>{l.label}</span>span>
                      </div>div>
                    ))}
                        </div>div>
                </Card>Card>
        
          {/* AI Trend Ideas */}
              <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                                <div>
                                            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">🤖 AI Trend Ideas</h3>h3>
                                            <p className="text-[11px] text-gray-400 mt-0.5">Pulled from health &amp; wellness trends</p>p>
                                </div>div>
                                <div style={{ background: '#f5f3ff', padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>Live Trends</div>div>
                      </div>div>
              
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {trendIdeas.map((item, i) => (
                      <div key={i} style={{ padding: '10px 12px', background: '#fafafa', borderRadius: 12, border: '1px solid #f0f0f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>{item.tag}</span>span>
                                                                      <span style={{ fontSize: 9, color: '#9ca3af' }}>{item.trend}</span>span>
                                                    </div>div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.platformColor }} />
                                                                      <span style={{ fontSize: 9, color: '#9ca3af' }}>{item.priority}</span>span>
                                                    </div>div>
                                    </div>div>
                                    <p style={{ fontSize: 11, color: '#374151', margin: '0 0 6px 0', lineHeight: 1.4 }}>{item.idea}</p>p>
                                    <button style={{ background: item.platformColor, color: 'white', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                                                    Add to {item.platform} Calendar +
                                    </button>button>
                      </div>div>
                    ))}
                      
                                <button
                                              className="w-full py-2.5 rounded-xl text-[12px] font-bold transition-all hover:opacity-90"
                                              style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}
                                            >
                                            ⚡ Generate Fresh Trend Ideas
                                </button>button>
                      </div>div>
              </Card>Card>
        </div>div>
      );
}</Card>
