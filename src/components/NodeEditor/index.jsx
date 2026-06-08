import React, { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import useStore from '../../store/index.js';
import { nodeTypes, NODE_DEFAULTS } from '../../nodes/index.js';
import ExecutionToolbar from './ExecutionToolbar.jsx';
import RunsPanel from './RunsPanel.jsx';

let nodeIdCounter = 1;
function generateId() {
  return `node_${Date.now()}_${nodeIdCounter++}`;
}

function FlowCanvas() {
  const workflow = useStore((s) => s.workflow);
  const executionStatus = useStore((s) => s.executionStatus);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const onConnect = useStore((s) => s.onConnect);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const setNodes = useStore((s) => s.setNodes);

  const { screenToFlowPosition } = useReactFlow();
  const reactFlowWrapper = useRef(null);
  const clipboard = useRef([]); // copied nodes

  // ── Copy / Paste ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      // Don't intercept when typing in an input/textarea
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrl  = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrl) return;

      if (e.key === 'c' || e.key === 'C') {
        const selected = workflow.nodes.filter((n) => n.selected);
        if (selected.length > 0) {
          clipboard.current = selected;
        }
      }

      if (e.key === 'v' || e.key === 'V') {
        if (clipboard.current.length === 0) return;
        e.preventDefault();

        const OFFSET = 40;
        const idMap  = {};
        const pasted = clipboard.current.map((n) => {
          const newId = generateId();
          idMap[n.id] = newId;
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
            selected: true,
            data: { ...n.data },
          };
        });

        // Deselect existing, add pasted
        const deselected = workflow.nodes.map((n) => ({ ...n, selected: false }));
        setNodes([...deselected, ...pasted]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workflow.nodes, setNodes]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/emulatorflow-node');
      if (!type) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const defaults = NODE_DEFAULTS[type] || { label: type };

      const newNode = {
        id: generateId(),
        type,
        position,
        data: { ...defaults },
      };

      setNodes([...workflow.nodes, newNode]);
    },
    [workflow.nodes, setNodes, screenToFlowPosition]
  );

  const onNodeClick = useCallback(
    (e, node) => {
      setSelectedNode(node);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const isRunning = executionStatus === 'running';

  // Add edge class when running
  const edgesWithClass = workflow.edges.map((edge) => ({
    ...edge,
    className: isRunning ? 'edge-running' : '',
  }));

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
      <ReactFlow
        nodes={workflow.nodes}
        edges={edgesWithClass}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode="Delete"
        style={{ background: '#0d1117' }}
        defaultEdgeOptions={{
          style: { stroke: '#30363d', strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#21262d"
        />
        <Controls
          style={{
            bottom: 16,
            left: 16,
          }}
        />
        <MiniMap
          style={{
            bottom: 16,
            right: 16,
            backgroundColor: '#161b22',
          }}
          nodeColor={(node) => {
            const typeColors = {
              start: '#22c55e',
              match_screen: '#3b82f6',
              find_element: '#3b82f6',
              wait_for_image: '#3b82f6',
              tap: '#a855f7',
              swipe: '#a855f7',
              type_text: '#a855f7',
              wait: '#f97316',
              loop: '#f97316',
              log: '#8b949e',
            };
            return typeColors[node.type] || '#484f58';
          }}
          maskColor="rgba(168, 85, 247, 0.08)"
        />
      </ReactFlow>

      <ExecutionToolbar />
      <RunsPanel />

      {/* Drop hint when canvas is empty */}
      {workflow.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-5xl mb-4 opacity-10">◆</div>
            <p className="text-text-muted text-sm">
              Drag nodes from the left panel to get started
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NodeEditor() {
  return (
    <ReactFlowProvider>
      <div className="flex-1 relative overflow-hidden">
        <FlowCanvas />
      </div>
    </ReactFlowProvider>
  );
}
