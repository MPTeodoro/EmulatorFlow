import React, { useState, useEffect } from 'react';
import { FolderOpen, Plus, Trash2, X, FolderIcon, Check } from 'lucide-react';
import useStore from '../../store/index.js';

function generateId() {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function loadProjects(projectsPath) {
  if (!window.electron) return [];
  await window.electron.ensureDir(projectsPath);
  const entries = await window.electron.listDir(projectsPath);
  const projects = [];
  for (const entry of entries) {
    const wfPath = `${projectsPath}/${entry}/workflow.json`;
    try {
      const base64 = await window.electron.readFile(wfPath);
      const json = JSON.parse(atob(base64));
      projects.push({ id: json.id || entry, name: json.name || entry, path: `${projectsPath}/${entry}` });
    } catch {
      // skip invalid
    }
  }
  return projects;
}

async function saveNewProject(projectsPath, name) {
  const id = generateId();
  const dirPath = `${projectsPath}/${name}`;
  await window.electron.ensureDir(dirPath);
  await window.electron.ensureDir(`${dirPath}/assets`);
  await window.electron.ensureDir(`${dirPath}/images`);
  const workflow = { id, name, nodes: [], edges: [] };
  const json = JSON.stringify(workflow, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  await window.electron.writeFile(`${dirPath}/workflow.json`, base64);
  return { id, name, path: dirPath };
}

async function deleteProject(projectPath) {
  // We just remove the workflow.json to "archive" — full delete not exposed
  // For a real delete we'd need a separate IPC call; skip for safety
  return true;
}

async function loadWorkflow(projectPath) {
  if (!window.electron) return null;
  const wfPath = `${projectPath}/workflow.json`;
  const base64 = await window.electron.readFile(wfPath);
  const decoded = decodeURIComponent(escape(atob(base64)));
  return JSON.parse(decoded);
}

async function saveWorkflow(projectPath, workflow) {
  if (!window.electron) return;
  const wfPath = `${projectPath}/workflow.json`;
  const json = JSON.stringify(workflow, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  await window.electron.writeFile(wfPath, base64);
}

async function loadProjectImages(projectPath) {
  if (!window.electron) return [];
  const imagesDir = `${projectPath}/images`;
  await window.electron.ensureDir(imagesDir);
  return window.electron.listImages(imagesDir);
}

export default function ProjectManager({ onClose }) {
  const currentProject   = useStore((s) => s.currentProject);
  const setCurrentProject = useStore((s) => s.setCurrentProject);
  const setProjects      = useStore((s) => s.setProjects);
  const projects         = useStore((s) => s.projects);
  const workflow         = useStore((s) => s.workflow);
  const setWorkflow      = useStore((s) => s.setWorkflow);
  const setImagesPath    = useStore((s) => s.setImagesPath);
  const setProjectImages = useStore((s) => s.setProjectImages);
  const addLog           = useStore((s) => s.addLog);

  const [projectsPath, setProjectsPath] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      if (!window.electron) return;
      const p = await window.electron.getProjectsPath();
      setProjectsPath(p);
      setLoading(true);
      const loaded = await loadProjects(p);
      setProjects(loaded);
      setLoading(false);
    }
    init();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError('Enter a project name');
      return;
    }
    if (!/^[\w\s-]+$/.test(newName.trim())) {
      setError('Name can only contain letters, numbers, spaces, hyphens, underscores');
      return;
    }
    setError('');
    setCreating(true);
    try {
      const project = await saveNewProject(projectsPath, newName.trim());
      setProjects([...projects, project]);
      setCurrentProject(project);
      setWorkflow({ nodes: [], edges: [] });

      // Each project has its own images folder
      const imagesDir = `${project.path}/images`;
      setImagesPath(imagesDir);
      setProjectImages([]);

      addLog({ level: 'info', message: `Created project: ${project.name}` });
      setNewName('');
      onClose();
    } catch (err) {
      setError(`Failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = async (project) => {
    // Save current project first
    if (currentProject && window.electron) {
      try {
        await saveWorkflow(currentProject.path, { ...workflow, id: currentProject.id, name: currentProject.name });
      } catch { /* ignore */ }
    }
    try {
      const wf = await loadWorkflow(project.path);
      if (wf) {
        setWorkflow({ nodes: wf.nodes || [], edges: wf.edges || [] });
      }
      setCurrentProject(project);

      // Switch to this project's images folder
      const imgs = await loadProjectImages(project.path);
      setImagesPath(`${project.path}/images`);
      setProjectImages(imgs);

      addLog({ level: 'info', message: `Opened project: ${project.name}` });
      onClose();
    } catch (err) {
      addLog({ level: 'error', message: `Failed to open project: ${err.message}` });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <FolderOpen size={16} className="text-accent-purple" />
          <h2 className="text-sm font-semibold text-text-primary flex-1">Projects</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="py-8 text-center text-text-muted text-sm">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="py-8 text-center text-text-muted text-sm">
              No projects yet. Create one below.
            </div>
          ) : (
            projects.map((p) => {
              const isCurrent = currentProject?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleOpen(p)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-1 text-left transition-colors
                    ${isCurrent
                      ? 'bg-accent-purple bg-opacity-10 border border-accent-purple border-opacity-30'
                      : 'hover:bg-bg-hover border border-transparent'
                    }`}
                >
                  <FolderIcon size={16} className={isCurrent ? 'text-accent-purple' : 'text-text-muted'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{p.name}</div>
                    <div className="text-[10px] text-text-muted truncate">{p.path}</div>
                  </div>
                  {isCurrent && <Check size={13} className="text-accent-purple shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Create new */}
        <div className="border-t border-border px-4 py-3">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">
            New Project
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Project name..."
              className="flex-1 text-sm bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-accent-purple hover:bg-opacity-80 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={14} />
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
          {error && <p className="text-xs text-accent-red mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
