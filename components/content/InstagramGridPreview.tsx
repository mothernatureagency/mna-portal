'use client';

/**
 * InstagramGridPreview
 *
 * A read-only mockup of how a client's scheduled posts will look laid out as
 * an Instagram profile grid — three square photos per row, newest first,
 * exactly like the real app. Pure preview: it never posts anything anywhere,
 * it just gives staff and clients a feel for how the feed will read visually
 * (which photos repeat, which colors clash, whether the sequence feels busy)
 * before anything goes out.
 *
 * Dumb/presentational by design — both the staff Content Tracker and the
 * client portal already load their own content_calendar rows into state, so
 * this just takes whatever list it's handed, keeps the ones with a real
 * (non-video) photo, and renders the grid. No fetching of its own.
 */

import React, { useState } from 'react';
import { previewSrc, isVideoUrl, photosOf } from '@/lib/drive';

export type GridPost = {
  id: string;
  post_date: string;
  title?: string | null;
  photo_drive_url?: string | null;
  photo_urls?: string[] | null;
};

export type GridClientInfo = {
  name: string;
  shortName?: string;
  logoUrl?: string;
  gradientFrom?: string;
  gradientTo?: string;
  /** Full instagram.com/... link if on file; a @handle is derived from it. */
  instagramLink?: string;
};

// Titles are stored like "[Promo] Real Title — Hook: ... | CTA: ..." — pull
// out just the human title, matching the convention used across the other
// content-preview widgets (NicevilleContentPreview, the client overview).
function parseTitle(raw: string | null | undefined): string {
  if (!raw) return '';
  const phaseMatch = raw.match(/^\[([^\]]+)\]\s*/);
  const rest = phaseMatch ? raw.slice(phaseMatch[0].length) : raw;
  const hookIdx = rest.indexOf(' — Hook:');
  return (hookIdx >= 0 ? rest.slice(0, hookIdx) : rest).trim();
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function igHandle(client: GridClientInfo): string {
  if (client.instagramLink) {
    const m = client.instagramLink.match(/instagram\.com\/([^/?#]+)/i);
    if (m && m[1]) return `@${m[1].replace(/\/$/, '')}`;
  }
  return `@${(client.shortName || client.name).toLowerCase().replace(/[^a-z0-9._]+/g, '')}`;
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

/** Cover image for a post — first photo only, and only if it isn't a video. */
function coverOf(p: GridPost): string | null {
  const [first] = photosOf(p);
  if (!first || isVideoUrl(first)) return null;
  return previewSrc(first, 400);
}

export default function InstagramGridPreview({
  client,
  posts,
  pageSize = 9,
}: {
  client: GridClientInfo;
  posts: GridPost[];
  /** How many tiles to show before "Show more" — defaults to a 3x3 grid. */
  pageSize?: number;
}) {
  const [count, setCount] = useState(pageSize);

  const withPhotos = posts
    .map((p) => ({ post: p, src: coverOf(p) }))
    .filter((x): x is { post: GridPost; src: string } => !!x.src)
    .sort((a, b) => (a.post.post_date < b.post.post_date ? 1 : a.post.post_date > b.post.post_date ? -1 : 0));

  if (withPhotos.length === 0) {
    return (
      <div className="text-center py-8 text-white/40 text-[12px]">
        No posts with a photo yet — once posts have images attached, they&apos;ll preview here as an Instagram grid.
      </div>
    );
  }

  const visible = withPhotos.slice(0, count);
  const remaining = withPhotos.length - visible.length;
  const gradient = `linear-gradient(135deg, ${client.gradientFrom || '#0c6da4'}, ${client.gradientTo || '#4ab8ce'})`;

  return (
    <div className="flex flex-col gap-3">
      {/* Mini profile header, styled like the real Instagram profile bar */}
      <div className="flex items-center gap-3 px-0.5">
        <div className="w-11 h-11 rounded-full p-[2px] shrink-0" style={{ background: gradient }}>
          <div className="w-full h-full rounded-full overflow-hidden bg-black/40 flex items-center justify-center ring-2 ring-black/20">
            {client.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-[12px] font-bold">{initials(client.shortName || client.name)}</span>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-white text-[13px] font-bold truncate">{igHandle(client)}</div>
          <div className="text-white/40 text-[11px]">{withPhotos.length} post{withPhotos.length === 1 ? '' : 's'} with photos · newest first</div>
        </div>
      </div>

      {/* 3-across square grid, thin gaps — the actual "collage" */}
      <div className="grid grid-cols-3 gap-[3px] rounded-lg overflow-hidden bg-white/5">
        {visible.map(({ post, src }) => {
          const label = parseTitle(post.title);
          return (
            <div key={post.id} className="relative aspect-square group overflow-hidden bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={label || 'Post photo'} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-black/60 flex flex-col items-center justify-center gap-1 p-2 text-center pointer-events-none">
                <span className="text-white text-[10px] font-bold">{formatShortDate(post.post_date)}</span>
                {label && <span className="text-white/80 text-[9px] leading-tight line-clamp-3">{label}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setCount((c) => c + pageSize)}
          className="self-center text-[11px] font-semibold text-white/60 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          Show {Math.min(remaining, pageSize)} more ({remaining} left)
        </button>
      )}
    </div>
  );
}
