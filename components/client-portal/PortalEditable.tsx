'use client';

import { usePortalEdit } from './PortalEditContext';

/**
 * Inline editors used inside portal sections.
 *
 * Outside edit mode they render exactly the markup the client sees, so a
 * section can be wrapped in these without changing its appearance. Inside
 * edit mode they turn into fields with a dashed underline.
 */

const editShell =
  'bg-white/10 rounded-md px-1.5 -mx-1.5 outline-none focus:bg-white/20 ' +
  'border-b border-dashed border-white/35 focus:border-white/70 transition-colors';

export function EditableText({
  value,
  onChange,
  className,
  style,
  placeholder = '—',
  fullWidth = false,
  minCh = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  fullWidth?: boolean;
  minCh?: number;
}) {
  const { editMode } = usePortalEdit();
  if (!editMode) {
    return (
      <span className={className} style={style}>
        {value || placeholder}
      </span>
    );
  }
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${className || ''} ${editShell}`}
      style={{
        ...style,
        width: fullWidth ? '100%' : `${Math.max(minCh, value.length + 1)}ch`,
        minWidth: fullWidth ? undefined : `${minCh}ch`,
      }}
    />
  );
}

export function EditableNumber({
  value,
  onChange,
  className,
  style,
  prefix = '',
  suffix = '',
  step = 1,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  style?: React.CSSProperties;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const { editMode } = usePortalEdit();
  if (!editMode) {
    return (
      <span className={className} style={style}>
        {prefix}
        {value.toLocaleString()}
        {suffix}
      </span>
    );
  }
  return (
    <span className={className} style={style}>
      {prefix}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className={editShell}
        style={{ width: `${Math.max(4, String(value).length + 2)}ch` }}
      />
      {suffix}
    </span>
  );
}

/** Small icon button used by row add/remove controls. */
export function EditButton({
  icon,
  label,
  onClick,
  tone = 'neutral',
}: {
  icon: string;
  label: string;
  onClick: () => void;
  tone?: 'neutral' | 'danger' | 'accent';
}) {
  const tones = {
    neutral: 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white',
    danger: 'bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-rose-100',
    accent: 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-100',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold transition-colors ${tones[tone]}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
        {icon}
      </span>
      {label}
    </button>
  );
}
