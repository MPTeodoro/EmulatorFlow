import React, { useState } from 'react';
import { Diamond, ChevronDown, Minus, Square, X, Wifi, WifiOff, Check, Loader, AlertCircle, FileJson, Wand2 } from 'lucide-react';
import useStore from '../../store/index.js';
import ProjectManager from '../ProjectManager/index.jsx';
import FlowIO from '../FlowIO/index.jsx';

const SAVE_INDICATOR = {
  saved:   { icon: Check,        color: 'text-text-muted',    label: 'Saved' },
  saving:  { icon: Loader,       color: 'text-accent-yellow', label: 'Saving...' },
  unsaved: { icon: AlertCircle,  color: 'text-accent-yellow', label: 'Unsaved' },
  error:   { icon: AlertCircle,  color: 'text-accent-red',    label: 'Save error' },
};

export default function TitleBar() {
  const currentProject = useStore((s) => s.currentProject);
  const wsConnected    = useStore((s) => s.wsConnected);
  const saveStatus     = useStore((s) => s.saveStatus);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showFlowIO, setShowFlowIO]               = useState(null); // null | 0 | 1 | 2 (tab index)

  const save = SAVE_INDICATOR[saveStatus] || SAVE_INDICATOR.saved;
  const SaveIcon = save.icon;

  const minimize = () => window.electron?.minimizeWindow();
  const maximize = () => window.electron?.maximizeWindow();
  const close = () => window.electron?.closeWindow();

  return (
    <>
      <div
        className="flex items-center h-10 bg-bg-secondary border-b border-border select-none shrink-0"
        style={{ WebkitAppRegion: 'drag' }}
      >
        {/* Left: logo + name */}
        <div className="flex items-center gap-2 px-4 min-w-[180px]">
          <Diamond size={16} className="text-accent-purple" />
          <span className="text-sm font-semibold text-text-primary tracking-wide">
            EmulatorFlow
          </span>
        </div>

        {/* Center: project selector */}
        <div className="flex-1 flex items-center justify-center">
          <button
            className="flex items-center gap-2 px-3 py-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary text-sm transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
            onClick={() => setShowProjectManager(true)}
          >
            <span className="max-w-[200px] truncate">
              {currentProject ? currentProject.name : 'No project open'}
            </span>
            <ChevronDown size={13} className="shrink-0" />
          </button>
        </div>

        {/* Right: ws status + window controls */}
        <div
          className="flex items-center gap-1 px-2 min-w-[180px] justify-end"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          {/* AI Generate */}
          <button
            onClick={() => setShowFlowIO(2)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-bg-hover text-text-muted hover:text-accent-purple transition-colors mr-1"
            title="AI Workflow Generator"
          >
            <Wand2 size={13} />
            <span className="text-[11px]">AI</span>
          </button>

          {/* Import / Export JSON */}
          <button
            onClick={() => setShowFlowIO(0)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors mr-2"
            title="Import / Export workflow JSON"
          >
            <FileJson size={13} />
            <span className="text-[11px]">JSON</span>
          </button>

          {/* Save status — só mostra quando há projeto aberto */}
          {currentProject && (
            <div className={`flex items-center gap-1 px-2 mr-1 ${save.color}`} title={save.label}>
              <SaveIcon size={11} className={saveStatus === 'saving' ? 'animate-spin' : ''} />
              <span className="text-[10px]">{save.label}</span>
            </div>
          )}

          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 px-3 mr-2">
            {wsConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-accent-green" />
                <Wifi size={12} className="text-accent-green" />
                <span className="text-[11px] text-accent-green">Engine</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-text-muted animate-pulse" />
                <WifiOff size={12} className="text-text-muted" />
                <span className="text-[11px] text-text-muted">Offline</span>
              </>
            )}
          </div>

          {/* Window controls */}
          <button
            onClick={minimize}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Minimize"
          >
            <Minus size={12} />
          </button>
          <button
            onClick={maximize}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Maximize"
          >
            <Square size={10} />
          </button>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-accent-red text-text-secondary hover:text-white transition-colors"
            title="Close"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {showProjectManager && (
        <ProjectManager onClose={() => setShowProjectManager(false)} />
      )}

      {showFlowIO !== null && (
        <FlowIO initialTab={showFlowIO} onClose={() => setShowFlowIO(null)} />
      )}
    </>
  );
}
