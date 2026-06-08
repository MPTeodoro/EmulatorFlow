import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';

const useStore = create((set, get) => ({
  // Projects
  projects: [],
  currentProject: null,

  // Workflow
  workflow: { nodes: [], edges: [] },

  // Execution — global fields mirror the "watched" run (currentRunId)
  executionStatus: 'idle',
  activeNodeId: null,
  nodeResults: {},

  // Multi-run: { [run_id]: { name, device, status, activeNodeId, nodeResults } }
  runs: {},
  currentRunId: null,

  // Devices
  devices: [],
  selectedDevice: null,

  // UI
  selectedNode: null,
  logs: [],
  wsConnected: false,
  adBlockEnabled: false,

  // Images
  projectImages: [],
  imagesPath: null,

  // Save status
  saveStatus: 'saved',

  // ── Workflow actions ──────────────────────────────────────────────────────
  setWorkflow: (workflow) => set({ workflow }),

  setNodes: (nodes) =>
    set((state) => ({ workflow: { ...state.workflow, nodes } })),

  setEdges: (edges) =>
    set((state) => ({ workflow: { ...state.workflow, edges } })),

  onNodesChange: (changes) =>
    set((state) => ({
      workflow: { ...state.workflow, nodes: applyNodeChanges(changes, state.workflow.nodes) },
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      workflow: { ...state.workflow, edges: applyEdgeChanges(changes, state.workflow.edges) },
    })),

  onConnect: (connection) =>
    set((state) => ({
      workflow: {
        ...state.workflow,
        edges: addEdge({ ...connection, animated: false }, state.workflow.edges),
      },
    })),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      workflow: {
        ...state.workflow,
        nodes: state.workflow.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        ),
      },
      selectedNode:
        state.selectedNode?.id === nodeId
          ? { ...state.selectedNode, data: { ...state.selectedNode.data, ...data } }
          : state.selectedNode,
    })),

  deleteNode: (nodeId) =>
    set((state) => ({
      workflow: {
        nodes: state.workflow.nodes.filter((n) => n.id !== nodeId),
        edges: state.workflow.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
      },
      selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode,
    })),

  // ── Single-run execution actions (mirror of watched run) ──────────────────
  setExecutionStatus: (status) => set({ executionStatus: status }),
  setActiveNodeId: (nodeId) => set({ activeNodeId: nodeId }),
  setNodeResult: (nodeId, result) =>
    set((state) => ({ nodeResults: { ...state.nodeResults, [nodeId]: result } })),
  clearNodeResults: () => set({ nodeResults: {}, activeNodeId: null }),

  // ── Multi-run actions ─────────────────────────────────────────────────────

  // Called when a new run starts — becomes the watched run
  addRun: (runId, name, device) =>
    set((state) => ({
      runs: {
        ...state.runs,
        [runId]: { name, device, status: 'running', activeNodeId: null, nodeResults: {} },
      },
      currentRunId: runId,
      executionStatus: 'running',
      activeNodeId: null,
      nodeResults: {},
    })),

  // Update a run's status/activeNode
  updateRunStatus: (runId, status, activeNodeId) =>
    set((state) => {
      const run = state.runs[runId];
      if (!run) return {};
      const updated = {
        ...state.runs,
        [runId]: {
          ...run,
          status,
          activeNodeId: activeNodeId !== undefined ? activeNodeId : run.activeNodeId,
        },
      };
      // Also mirror into global fields if this is the watched run
      const isWatched = runId === state.currentRunId;
      return {
        runs: updated,
        ...(isWatched ? { executionStatus: status, activeNodeId: activeNodeId ?? state.activeNodeId } : {}),
      };
    }),

  // Update a node result within a specific run
  setRunNodeResult: (runId, nodeId, result) =>
    set((state) => {
      const run = state.runs[runId];
      if (!run) return {};
      const updatedRun = {
        ...run,
        nodeResults: { ...run.nodeResults, [nodeId]: result },
      };
      const isWatched = runId === state.currentRunId;
      return {
        runs: { ...state.runs, [runId]: updatedRun },
        ...(isWatched ? { nodeResults: { ...state.nodeResults, [nodeId]: result } } : {}),
      };
    }),

  // Remove a run (called when run_ended received)
  removeRun: (runId) =>
    set((state) => {
      const { [runId]: _removed, ...rest } = state.runs;
      const wasWatched = runId === state.currentRunId;
      const remainingIds = Object.keys(rest);
      const nextRunId = wasWatched
        ? (remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null)
        : state.currentRunId;

      // If we're switching watched run, mirror its state
      const nextRun = nextRunId ? rest[nextRunId] : null;

      return {
        runs: rest,
        currentRunId: nextRunId,
        ...(wasWatched ? {
          executionStatus: nextRun?.status ?? 'idle',
          activeNodeId: nextRun?.activeNodeId ?? null,
          nodeResults: nextRun?.nodeResults ?? {},
        } : {}),
      };
    }),

  // Manually switch which run to watch on the canvas
  watchRun: (runId) =>
    set((state) => {
      const run = state.runs[runId];
      if (!run) return {};
      return {
        currentRunId: runId,
        executionStatus: run.status,
        activeNodeId: run.activeNodeId,
        nodeResults: run.nodeResults,
      };
    }),

  setCurrentRunId: (runId) => set({ currentRunId: runId }),

  // Populate runs from backend on WS reconnect (runs_sync)
  syncRuns: (runList) =>
    set((state) => {
      const merged = { ...state.runs };
      for (const r of runList) {
        if (!merged[r.run_id]) {
          merged[r.run_id] = { name: r.name, device: r.device, status: 'running', activeNodeId: null, nodeResults: {} };
        }
      }
      // Remove runs that are no longer active
      const activeIds = new Set(runList.map((r) => r.run_id));
      for (const rid of Object.keys(merged)) {
        if (!activeIds.has(rid)) delete merged[rid];
      }
      return { runs: merged };
    }),

  // ── Device actions ────────────────────────────────────────────────────────
  setDevices: (devices) => set({ devices }),
  setSelectedDevice: (device) => set({ selectedDevice: device }),
  setAdBlockEnabled: (enabled) => set({ adBlockEnabled: enabled }),

  // ── UI actions ────────────────────────────────────────────────────────────
  setSelectedNode: (node) => set({ selectedNode: node }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setProjectImages: (images) => set({ projectImages: images }),
  addProjectImage: (image) =>
    set((state) => ({ projectImages: [image, ...state.projectImages] })),
  removeProjectImage: (filePath) =>
    set((state) => ({
      projectImages: state.projectImages.filter((img) => img.path !== filePath),
    })),
  setImagesPath: (imagesPath) => set({ imagesPath }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),

  addLog: (log) =>
    set((state) => ({
      logs: [
        ...state.logs.slice(-499),
        {
          timestamp: log.timestamp || new Date().toISOString(),
          level: log.level || 'info',
          message: log.message || '',
        },
      ],
    })),

  clearLogs: () => set({ logs: [] }),

  // ── Project actions ───────────────────────────────────────────────────────
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),

  setProjects: (projects) => set({ projects }),

  // Reset execution state when switching projects
  setCurrentProject: (project) =>
    set({
      currentProject: project,
      currentRunId: null,
      executionStatus: 'idle',
      activeNodeId: null,
      nodeResults: {},
    }),
}));

export default useStore;
