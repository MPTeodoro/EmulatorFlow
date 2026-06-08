import React from 'react';
import { Square, Eye } from 'lucide-react';
import useStore from '../../store/index.js';
import useApi from '../../hooks/useApi.js';

const STATUS_DOT = {
  running: 'bg-accent-green animate-pulse',
  paused:  'bg-accent-yellow',
  stopped: 'bg-text-muted',
  error:   'bg-accent-red',
  idle:    'bg-text-muted',
};

export default function RunsPanel() {
  const runs         = useStore((s) => s.runs);
  const currentRunId = useStore((s) => s.currentRunId);
  const watchRun     = useStore((s) => s.watchRun);
  const addLog       = useStore((s) => s.addLog);
  const api          = useApi();

  const runList = Object.entries(runs);
  if (runList.length === 0) return null;

  const handleStop = async (e, runId) => {
    e.stopPropagation();
    try {
      await api.stopExecution(runId);
    } catch (err) {
      addLog({ level: 'error', message: `Stop run ${runId} failed: ${err.message}` });
    }
  };

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5" style={{ minWidth: 200 }}>
      <div className="text-[9px] font-bold text-text-muted tracking-widest uppercase px-1 mb-0.5">
        Active Runs ({runList.length})
      </div>

      {runList.map(([runId, run]) => {
        const isWatched = runId === currentRunId;
        const dotClass  = STATUS_DOT[run.status] || 'bg-text-muted';

        return (
          <div
            key={runId}
            onClick={() => watchRun(runId)}
            className={`flex items-center gap-2 bg-bg-secondary border rounded-lg px-2.5 py-1.5 shadow-md cursor-pointer transition-all ${
              isWatched
                ? 'border-accent-purple ring-1 ring-accent-purple ring-opacity-40'
                : 'border-border hover:border-text-muted'
            }`}
          >
            {/* Status dot */}
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-text-primary truncate max-w-[100px]">
                  {run.name}
                </span>
                {isWatched && (
                  <span className="text-[9px] bg-accent-purple bg-opacity-20 text-accent-purple px-1 rounded font-semibold shrink-0">
                    watching
                  </span>
                )}
              </div>
              <div className="text-[10px] text-text-muted truncate">{run.device}</div>
            </div>

            {/* Watch / Stop */}
            <div className="flex items-center gap-1 shrink-0">
              {!isWatched && (
                <button
                  onClick={(e) => { e.stopPropagation(); watchRun(runId); }}
                  className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-accent-purple transition-colors"
                  title="Watch this run on canvas"
                >
                  <Eye size={11} />
                </button>
              )}
              <button
                onClick={(e) => handleStop(e, runId)}
                className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors"
                title="Stop this run"
              >
                <Square size={11} className="fill-current" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
