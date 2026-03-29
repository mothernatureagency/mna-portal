'use client';
import React from 'react';
import { TrendingUp, Sparkles, ArrowUpRight } from 'lucide-react';
import { topPosts, contentIdeas } from '@/lib/demoData';
import { useClient } from '@/context/ClientContext';
import Card from '@/components/ui/Card';

const platformMeta: Record<string, { emoji: string; color: string; bg: string }> = {
  Instagram: { emoji: '📸', color: '#e1306c', bg: 'rgba(225,48,108,0.08)' },
  Facebook:  { emoji: '👥', color: '#1877f2', bg: 'rgba(24,119,242,0.08)' },
  LinkedIn:  { emoji: '💼', color: '#0a66c2', bg: 'rgba(10,102,194,0.08)' },
  TikTok:    { emoji: '🎵', color: '#010101', bg: 'rgba(0,0,0,0.06)' },
};

export default function ContentSection() {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* Top Posts */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">Top Performing Posts</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Last 30 days by engagement</p>
          </div>
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: `${gradientFrom}12` }}
          >
            <TrendingUp size={13} style={{ color: gradientFrom }} />
          </div>
        </div>

        <div className="space-y-2.5">
          {topPosts.map((post, i) => {
            const meta = platformMeta[post.platform] ?? { emoji: '🌐', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' };
            return (
              <div
                key={i}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl transition-all duration-150 hover:bg-gray-50/80 cursor-pointer group"
                style={{ border: '1px solid rgba(0,0,0,0.04)' }}
              >
                {/* Platform icon */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: meta.bg }}
                >
                  {meta.emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-gray-800 truncate">{post.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-400">{post.platform}</span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {post.type}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-[14px] font-bold text-gray-900">{post.engagement.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400">engagements</div>
                </div>

                <ArrowUpRight
                  size={13}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: gradientFrom }}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* AI Content Ideas */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[15px] font-bold text-gray-900 tracking-tight">AI Content Ideas</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Generated for this week</p>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
          >
            <Sparkles size={10} />
            AI
          </div>
        </div>

        <div className="space-y-2">
          {contentIdeas.map((idea, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-150 hover:scale-[1.01] group"
              style={{
                border: '1px solid rgba(0,0,0,0.05)',
                background: 'rgba(248,250,252,0.5)',
              }}
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 mt-0.5"
                style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
              >
                {i + 1}
              </div>
              <p className="text-[13px] text-gray-600 group-hover:text-gray-800 transition-colors leading-relaxed flex-1">
                {idea}
              </p>
              <ArrowUpRight
                size={13}
                className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: gradientFrom }}
              />
            </div>
          ))}
        </div>

        <button
          className="w-full mt-4 py-2.5 rounded-2xl text-[13px] font-semibold transition-all hover:opacity-80"
          style={{
            borderStyle: 'dashed',
            borderWidth: '1.5px',
            borderColor: `${gradientFrom}35`,
            color: gradientFrom,
            background: `${gradientFrom}06`,
          }}
        >
          + Generate More Ideas
        </button>
      </Card>
    </div>
  );
}
