import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Trash2, Terminal } from 'lucide-react';
import useStore from '../../store/index.js';

const LEVEL_STYLES = {
  info: { color: '#8b949e', bg: 'rgba(139,148,158,0.1)', label: 'INFO' },
  warn: { color: '#eab308', bg: 'rgba(234,179,8,0.1)', label: 'WARN' },
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'ERR ' },
  debug: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'DBG ' },
};

function formatTimestamp(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return '';
  }
}

export default function LogBar() {
  const logs = useStore((s) => s.logs);
  const clearLogs = useStore((s) => s.clearLogs);

  const [expanded, setExpanded] = useState(false);
  const logEndRef = useRef(null);
  const scrollRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, expanded, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 20;
    setAutoScroll(atBottom);
  };

  const lastLog = logs[logs.length - 1];
  const lastLevelStyle = lastLog ? (LEVEL_STYLES[lastLog.level] || LEVEL_STYLES.info) : null;

  return (
    <div
      className="bg-bg-secondary border-t border-border flex flex-col shrink-0 transition-all duration-200"
      style={{ height: expanded ? 200 : 32 }}
    >
      {/* Header bar */}
      <div
        className="flex items-center h-8 px-3 gap-2 cursor-pointer hover:bg-bg-hover transition-colors shrink-0"
        onClick={() => setExpanded((v) => !v)}
      >
        <Terminal size={12} className="text-text-muted shrink-0" />
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mr-2">
          Logs
        </span>

        {!expanded && lastLog && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className="text-[9px] font-mono font-bold px-1 rounded"
              style={{
                color: lastLevelStyle.color,
                backgroundColor: lastLevelStyle.bg,
              }}
            >
              {lastLevelStyle.label}
            </span>
            <span className="text-xs text-text-muted font-mono truncate">
              {lastLog.message}
            </span>
          </div>
        )}

        {!expanded && !lastLog && (
          <span className="text-xs text-text-muted italic flex-1">No logs yet</span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {logs.length > 0 && (
            <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded-full">
              {logs.length}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearLogs();
            }}
            className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title="Clear logs"
          >
            <Trash2 size={11} />
          </button>
          {expanded ? (
            <ChevronDown size={12} className="text-text-muted" />
          ) : (
            <ChevronUp size={12} className="text-text-muted" />
          )}
        </div>
      </div>

      {/* Log entries */}
      {expanded && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto font-mono text-xs"
        >
          {logs.length === 0 ? (
            <div className="px-4 py-3 text-text-muted italic">No logs yet</div>
          ) : (
            logs.map((log, i) => {
              const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 px-3 py-0.5 hover:bg-bg-hover transition-colors"
                >
                  <span className="text-text-muted text-[10px] shrink-0 mt-0.5 w-18">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span
                    className="text-[9px] font-bold px-1 rounded mt-0.5 shrink-0 w-8 text-center"
                    style={{ color: style.color, backgroundColor: style.bg }}
                  >
                    {style.label}
                  </span>
                  <span className="text-text-secondary break-all leading-relaxed">
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
