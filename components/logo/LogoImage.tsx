'use client';

/**
 * LogoImage — unified logo renderer for SVG and PNG files
 *
 * ─── SVG files ─────────────────────────────────────────────
 * Rendered with a plain <img> tag (NOT next/image).
 * Why: SVG is already infinitely scalable — no optimization
 * step is needed, and next/image blocks SVGs by default
 * for security reasons. <img> with a CSS height constraint
 * correctly preserves aspect ratio via `width: auto`.
 *
 * ─── PNG files ─────────────────────────────────────────────
 * Rendered with next/image using a sized container + fill mode.
 * Why: Large source PNGs (like Prime IV at 9088×4420px) need
 * server-side resizing. next/image generates optimized srcSet
 * entries and serves WebP/AVIF at appropriate display sizes,
 * which delivers retina quality without loading the full file.
 *
 * ─── Aspect ratio ──────────────────────────────────────────
 * Only the HEIGHT is fixed. Width is always computed from the
 * source aspect ratio (or auto for SVG). This prevents any
 * stretching or distortion regardless of container size.
 *
 * ─── Sizing reference ──────────────────────────────────────
 * Context            Height   Notes
 * ─────────────────────────────────────────────────────────
 * Sidebar icon        38px    Square icon mark
 * Sidebar full        36px    Stacked/square full logo
 * Header button       26px    Compact for header bar
 * Switcher dropdown   24px    List item icon
 * Switcher compact    20px    Smallest usage
 */

import React from 'react';
import Image from 'next/image';

// Known source dimensions for PNG logos — used to compute display width
// so next/image can render with correct aspect ratio.
// Update this map when adding new client PNG logos.
export const PNG_DIMENSIONS: Record<string, { w: number; h: number }> = {
  '/logos/primeiv-logo.png': { w: 9088, h: 4420 },  // aspect ≈ 2.054
};

type LogoImageProps = {
  /** Absolute path from /public (e.g. "/logos/mna-logo.svg") */
  src: string;
  /** Alt text for accessibility */
  alt: string;
  /**
   * Display height in pixels — the single source of truth for sizing.
   * Width is always derived from aspect ratio.
   */
  height: number;
  /**
   * Optional max width cap (px). Useful when the logo would be too
   * wide in a constrained space (e.g. sidebar icon slot).
   */
  maxWidth?: number;
  /** Additional CSS classes for the root element */
  className?: string;
  /** Extra inline styles */
  style?: React.CSSProperties;
  /** next/image quality (PNG only). Default: 95 */
  quality?: number;
};

export default function LogoImage({
  src,
  alt,
  height,
  maxWidth,
  className = '',
  style,
  quality = 95,
}: LogoImageProps) {
  const isSvg = src.toLowerCase().endsWith('.svg');

  // ── SVG: plain <img> tag ──────────────────────────────────
  // width: auto lets the browser calculate the correct width
  // from the SVG's intrinsic aspect ratio (preserveAspectRatio).
  if (isSvg) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          height: `${height}px`,
          width: 'auto',
          maxWidth: maxWidth ? `${maxWidth}px` : undefined,
          display: 'block',
          flexShrink: 0,
          // Force hardware-accelerated compositing for crisp sub-pixel rendering
          transform: 'translateZ(0)',
          ...style,
        }}
        // Prevent browser from applying default image borders/outlines
        draggable={false}
      />
    );
  }

  // ── PNG: next/image with fill container ──────────────────
  // Compute the display width from the known source aspect ratio.
  const dims = PNG_DIMENSIONS[src];
  const aspect = dims ? dims.w / dims.h : 2; // default fallback: 2:1
  const displayWidth = Math.round(height * aspect);
  const cappedWidth = maxWidth ? Math.min(displayWidth, maxWidth) : displayWidth;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: `${cappedWidth}px`,
        height: `${height}px`,
        flexShrink: 0,
        ...style,
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        style={{
          objectFit: 'contain',
          // Left-align: logos often have leading content (wordmark starts left)
          objectPosition: 'left center',
        }}
        quality={quality}
        // Provide a responsive sizes hint so next/image picks the right
        // srcSet entry. We serve 2× for retina readiness.
        sizes={`${cappedWidth * 2}px`}
        // Logos are above the fold — don't lazy load
        priority
        draggable={false}
      />
    </div>
  );
}
