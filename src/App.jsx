import React, { useEffect, useRef, useState } from 'react';
import useStore from './store/index.js';
import useWebSocket from './hooks/useWebSocket.js';
import TitleBar from './components/TitleBar/index.jsx';
import LeftSidebar from './components/LeftSidebar/index.jsx';
import NodeEditor from './components/NodeEditor/index.jsx';
import PropertiesPanel from './components/PropertiesPanel/index.jsx';
import LogBar from './components/LogBar/index.jsx';
import { AlertTriangle, RefreshCw, Download } from 'lucide-react';

function encodeWorkflow(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))));
}

function decodeWorkflow(base64) {
  return JSON.parse(decodeURIComponent(escape(atob(base64))));
}

export default function App() {
  const addLog        = useStore((s) => s.addLog);
  const wsConnected   = useStore((s) => s.wsConnected);
  const setImagesPath = useStore((s) => s.setImagesPath);

  const [engineBanner, setEngineBanner] = useState(null); // null | 'offline' | 'crash'
  const [updateBanner, setUpdateBanner] = useState(null); // null | { version, ready }
  const engineTimeoutRef = useRef(null);
  const setProjectImages = useStore((s) => s.setProjectImages);
  const workflow      = useStore((s) => s.workflow);
  const currentProject = useStore((s) => s.currentProject);
  const setCurrentProject = useStore((s) => s.setCurrentProject);
  const setWorkflow   = useStore((s) => s.setWorkflow);
  const setSaveStatus = useStore((s) => s.setSaveStatus);
  const setProjects   = useStore((s) => s.setProjects);

  const autoSaveTimer = useRef(null);
  const lastSavedRef  = useRef(null); // JSON string of last saved workflow

  useWebSocket();

  // ── Engine offline detection ───────────────────────────────────────────────
  useEffect(() => {
    if (wsConnected) {
      setEngineBanner(null);
      if (engineTimeoutRef.current) clearTimeout(engineTimeoutRef.current);
      return;
    }
    engineTimeoutRef.current = setTimeout(() => {
      if (!wsConnected) setEngineBanner('offline');
    }, 9000);
    return () => { if (engineTimeoutRef.current) clearTimeout(engineTimeoutRef.current); };
  }, [wsConnected]);

  // ── Engine crash / update events from Electron ────────────────────────────
  useEffect(() => {
    if (!window.electron) return;

    const unsubEngine = window.electron.onEngineStatus?.((status) => {
      if (!status.ok) setEngineBanner(status.reason === 'crash' ? 'crash' : 'offline');
      else setEngineBanner(null);
    });

    const unsubUpdate = window.electron.onUpdateStatus?.((status) => {
      setUpdateBanner({ version: status.version, ready: status.type === 'ready' });
    });

    return () => { unsubEngine?.(); unsubUpdate?.(); };
  }, []);

  // ── Startup: restore last project + default images folder ─────────────────
  useEffect(() => {
    if (!window.electron) return;

    window.electron.getProjectsPath().then(async (projectsPath) => {
      const base = projectsPath.replace(/[/\\]projects$/, '');

      // Restore last open project
      const settingsPath = `${base}/settings.json`;
      try {
        const raw = await window.electron.readFile(settingsPath);
        const settings = JSON.parse(decodeURIComponent(escape(atob(raw))));
        if (settings.lastProjectPath && settings.lastProjectId) {
          const wfPath = `${settings.lastProjectPath}/workflow.json`;
          try {
            const wfRaw = await window.electron.readFile(wfPath);
            const wf = decodeWorkflow(wfRaw);
            setWorkflow({ nodes: wf.nodes || [], edges: wf.edges || [] });
            setCurrentProject({
              id: settings.lastProjectId,
              name: settings.lastProjectName || 'Project',
              path: settings.lastProjectPath,
            });
            lastSavedRef.current = JSON.stringify({ nodes: wf.nodes || [], edges: wf.edges || [] });

            // Load this project's own images folder
            const imagesDir = `${settings.lastProjectPath}/images`;
            await window.electron.ensureDir(imagesDir);
            setImagesPath(imagesDir);
            const imgs = await window.electron.listImages(imagesDir);
            setProjectImages(imgs);
          } catch { /* workflow file missing, ignore */ }
        }
      } catch { /* no settings yet, first run */ }

      // Populate project list
      await window.electron.ensureDir(projectsPath);
      const entries = await window.electron.listDir(projectsPath);
      const projects = [];
      for (const entry of entries) {
        const wfPath = `${projectsPath}/${entry}/workflow.json`;
        try {
          const raw = await window.electron.readFile(wfPath);
          const wf = decodeWorkflow(raw);
          projects.push({ id: wf.id || entry, name: wf.name || entry, path: `${projectsPath}/${entry}` });
        } catch { /* skip */ }
      }
      setProjects(projects);
    });
  }, []);

  // ── Auto-save with 1.5s debounce ──────────────────────────────────────────
  useEffect(() => {
    if (!currentProject || !window.electron) return;

    const snapshot = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges });
    if (snapshot === lastSavedRef.current) return; // nothing changed

    setSaveStatus('unsaved');

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const toSave = {
          id: currentProject.id,
          name: currentProject.name,
          nodes: workflow.nodes,
          edges: workflow.edges,
        };
        await window.electron.writeFile(
          `${currentProject.path}/workflow.json`,
          encodeWorkflow(toSave)
        );

        // Persist last-open project in settings.json
        const base = currentProject.path.replace(/[/\\]projects[/\\][^/\\]+$/, '');
        const settings = {
          lastProjectId: currentProject.id,
          lastProjectName: currentProject.name,
          lastProjectPath: currentProject.path,
        };
        await window.electron.writeFile(
          `${base}/settings.json`,
          encodeWorkflow(settings)
        );

        lastSavedRef.current = snapshot;
        setSaveStatus('saved');
      } catch (err) {
        setSaveStatus('error');
        addLog({ level: 'error', message: `Auto-save failed: ${err.message}` });
      }
    }, 1500);

    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [workflow, currentProject]);

  // ── Python engine logs ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.electron?.onPythonLog) return;
    return window.electron.onPythonLog((data) => {
      addLog({
        level: data.level || 'info',
        message: `[Engine] ${data.message}`,
        timestamp: new Date().toISOString(),
      });
    });
  }, [addLog]);

  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      <TitleBar />

      {/* Engine offline banner */}
      {engineBanner && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent-red bg-opacity-10 border-b border-accent-red border-opacity-20 shrink-0">
          <AlertTriangle size={13} className="text-accent-red shrink-0" />
          <span className="text-xs text-accent-red flex-1">
            {engineBanner === 'crash'
              ? 'The Python engine crashed. Try restarting the app.'
              : 'Engine offline — the app cannot execute flows. Try restarting.'}
          </span>
          <button
            onClick={() => window.electron?.relaunchApp()}
            className="flex items-center gap-1 text-xs text-accent-red border border-accent-red border-opacity-40 px-2 py-0.5 rounded hover:bg-accent-red hover:bg-opacity-15 transition-colors"
          >
            <RefreshCw size={10} /> Restart
          </button>
        </div>
      )}

      {/* Update banner */}
      {updateBanner && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent-purple bg-opacity-10 border-b border-accent-purple border-opacity-20 shrink-0">
          <Download size={13} className="text-accent-purple shrink-0" />
          <span className="text-xs text-text-secondary flex-1">
            {updateBanner.ready
              ? `EmulatorFlow ${updateBanner.version} downloaded — restart to install.`
              : `Update ${updateBanner.version} available — downloading in background...`}
          </span>
          {updateBanner.ready && (
            <button
              onClick={() => window.electron?.installUpdate()}
              className="flex items-center gap-1 text-xs text-accent-purple border border-accent-purple border-opacity-40 px-2 py-0.5 rounded hover:bg-accent-purple hover:bg-opacity-15 transition-colors"
            >
              Restart & Update
            </button>
          )}
          <button onClick={() => setUpdateBanner(null)} className="text-text-muted hover:text-text-primary text-xs px-1">✕</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <NodeEditor />
        <PropertiesPanel />
      </div>
      <LogBar />
    </div>
  );
}
