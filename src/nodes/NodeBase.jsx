import React from 'react';

export default function NodeBase({ selected, isActive, categoryClass, header, children, style }) {
  return (
    <div
      className={`
        ${categoryClass} relative
        bg-bg-secondary border border-border rounded-md
        overflow-hidden cursor-default
        ${selected ? 'ring-2 ring-accent-purple' : ''}
        ${isActive ? 'node-active' : ''}
      `}
      style={{ minWidth: 200, ...style }}
    >
      {header}
      {children && (
        <div className="px-3 py-2 space-y-1 bg-bg-primary bg-opacity-40">
          {children}
        </div>
      )}
    </div>
  );
}

export function NodeHeader({ icon, label, bgColor, textColor }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{ backgroundColor: bgColor || '#1c2128' }}
    >
      <span style={{ color: textColor || '#e6edf3' }}>{icon}</span>
      <span
        className="text-xs font-semibold truncate max-w-[140px]"
        style={{ color: textColor || '#e6edf3' }}
        title={label}
      >
        {label}
      </span>
    </div>
  );
}

export function NodeProp({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-text-muted">{label}:</span>
      <span className="text-text-secondary truncate max-w-[130px]" title={String(value)}>
        {String(value)}
      </span>
    </div>
  );
}
