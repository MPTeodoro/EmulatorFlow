import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Pause, RotateCcw, Camera, X } from 'lucide-react';
import useStore from '../../store/index.js';
import useApi from '../../hooks/useApi.js';

const STATUS_COLORS = {
  idle:    '#8b949e',
  running: '#22c55e',
  paused:  '#eab308',
  stopped: '#8b949e',
  error:   '#ef4444',
};

const STATUS_LABELS = {
  idle:    'Idle',
  running: 'Running',
  paused:  'Paused',
  stopped: 'Stopped',
  error:   'Error',
};

export default function ExecutionToolbar() {
  const workflow        = useStore((s) => s.workflow);
  const currentProject  = useStore((s) => s.currentProject);
  const selectedDevice  = useStore((s) => s.selectedDevice);
  const executionStatus = useStore((s) => s.executionStatus); // mirrors watched run
  const currentRunId    = useStore((s) => s.currentRunId);
  const runs            = useStore((s) => s.runs);
  const addRun          = useStore((s) => s.addRun);
  const clearNodeResults = useStore((s) => s.clearNodeResults);
  const addLog          = useStore((s) => s.addLog);
  const imagesPath      = useStore((s) => s.imagesPath);
  const addProjectImage = useStore((s) => s.addProjectImage);

  const [toast, setToast]                     = useState(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const toastTimer = useRef(null);

  const api = useApi();

  // Status of the run we're currently watching
  const currentRun = runs[currentRunId];
  const isRunning  = executionStatus === 'running';
  const isPaused   = executionStatus === 'paused';
  const isActive   = isRunning || isPaused;

  const handleStart = async () => {
    if (!selectedDevice) {
      addLog({ level: 'warn', message: 'No device selected. Select a device first.' });
      return;
    }

    const wf = {
      id: currentProject?.id || 'unsaved',
      name: currentProject?.name || 'Untitled',
      nodes: workflow.nodes,
      edges: workflow.edges,
    };

    addLog({ level: 'info', message: `Starting "${wf.name}" on ${selectedDevice.id}...` });

    try {
      const res = await api.startExecution(wf, selectedDevice.id);
      // addRun sets currentRunId and mirrors executionStatus = 'running'
      addRun(res.run_id, wf.name, selectedDevice.id);
      addLog({ level: 'info', message: `Run ${res.run_id} started` });
    } catch (err) {
      addLog({ level: 'error', message: `Start failed: ${err.message}` });
    }
  };

  const handleStop = async () => {
    if (!currentRunId) return;
    try {
      await api.stopExecution(currentRunId);
      addLog({ level: 'info', message: `Stopping run ${currentRunId}...` });
    } catch (err) {
      addLog({ level: 'error', message: `Stop failed: ${err.message}` });
    }
  };

  const handlePause = async () => {
    if (!currentRunId) return;
    try {
      const res = await api.pauseExecution(currentRunId);
      addLog({ level: 'info', message: `Execution ${res.status}` });
    } catch (err) {
      addLog({ level: 'error', message: `Pause failed: ${err.message}` });
    }
  };

  const handleReset = () => {
    clearNodeResults();
    addLog({ level: 'info', message: 'Execution reset' });
  };

  const showToast = (name, dataUrl) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ name, dataUrl });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const handleScreenshot = async () => {
    if (!selectedDevice) {
      addLog({ level: 'warn', message: 'No device selected.' });
      return;
    }
    setScreenshotLoading(true);
    try {
      const base64 = await api.takeScreenshot(selectedDevice.id);
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      if (window.electron && imagesPath) {
        const saved = await window.electron.saveScreenshot(base64, imagesPath);
        addProjectImage({ name: saved.name, path: saved.path, dataUrl });
        showToast(saved.name, dataUrl);
      } else {
        showToast(`screenshot_${Date.now()}.jpg`, dataUrl);
      }
    } catch (err) {
      addLog({ level: 'error', message: `Screenshot failed: ${err.message}` });
    } finally {
      setScreenshotLoading(false);
    }
  };

  const statusColor = STATUS_COLORS[executionStatus] || '#8b949e';

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-bg-secondary border border-border rounded-lg px-3 py-1.5 shadow-lg z-10">

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 mr-1">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: statusColor,
            boxShadow: isRunning ? `0 0 6px ${statusColor}` : 'none',
          }}
        />
        <span className="text-xs text-text-secondary w-14">
          {STATUS_LABELS[executionStatus] || 'Idle'}
        </span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Run — always available, starts a new parallel run */}
      <button
        onClick={handleStart}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent-green bg-opacity-15 hover:bg-opacity-25 text-accent-green border border-accent-green border-opacity-30 text-xs font-semibold transition-colors"
        title="Start a new run (keeps existing runs active)"
      >
        <Play size={12} className="fill-current" />
        Run
      </button>

      {/* Pause / Stop — only when watched run is active */}
      {isActive && (
        <>
          <button
            onClick={handlePause}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent-yellow bg-opacity-15 hover:bg-opacity-25 text-accent-yellow border border-accent-yellow border-opacity-30 text-xs font-semibold transition-colors"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            <Pause size={12} />
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent-red bg-opacity-15 hover:bg-opacity-25 text-accent-red border border-accent-red border-opacity-30 text-xs font-semibold transition-colors"
            title="Stop this run"
          >
            <Square size={12} className="fill-current" />
            Stop
          </button>
        </>
      )}

      {(executionStatus === 'stopped' || executionStatus === 'error') && (
        <button
          onClick={handleReset}
          className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          title="Reset"
        >
          <RotateCcw size={13} />
        </button>
      )}

      <div className="w-px h-4 bg-border" />

      {/* Screenshot */}
      <button
        onClick={handleScreenshot}
        disabled={screenshotLoading || !selectedDevice}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent-blue bg-opacity-15 hover:bg-opacity-25 text-accent-blue border border-accent-blue border-opacity-30 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Take screenshot from device"
      >
        <Camera size={12} className={screenshotLoading ? 'animate-pulse' : ''} />
        {screenshotLoading ? 'Capturing...' : 'Screenshot'}
      </button>

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-bg-secondary border border-border rounded-lg px-3 py-2 shadow-lg pointer-events-auto">
          <img
            src={toast.dataUrl}
            alt="preview"
            className="w-8 h-14 object-cover rounded border border-border shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-text-primary">Screenshot salva</span>
            <span className="text-[10px] text-text-muted truncate" style={{ maxWidth: 160 }}>{toast.name}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
