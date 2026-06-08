import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { RefreshCw } from 'lucide-react';
import useStore from '../store/index.js';
import NodeBase, { NodeHeader } from './NodeBase.jsx';

export default function LoopNode({ id, data, selected }) {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  const iterations = data.iterations;
  const displayIterations =
    iterations === -1 || iterations === undefined
      ? '∞'
      : String(iterations);

  return (
    <NodeBase
      selected={selected}
      isActive={isActive}
      categoryClass="node-control"
    >
      <NodeHeader
        icon={<RefreshCw size={13} />}
        label={data.label || 'Loop'}
        bgColor="rgba(249, 115, 22, 0.15)"
        textColor="#f97316"
      />

      <div className="px-3 py-2 bg-bg-primary bg-opacity-40">
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">Iterations:</span>
          <span className="text-accent-orange text-sm font-bold">{displayIterations}</span>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{ background: '#8b949e', border: '2px solid #484f58', top: '50%' }}
      />
      {/* body - loops back into loop body */}
      <Handle
        type="source"
        position={Position.Right}
        id="body"
        style={{ background: '#a855f7', border: '2px solid #9333ea', top: '35%' }}
      />
      {/* done - exits loop */}
      <Handle
        type="source"
        position={Position.Right}
        id="done"
        style={{ background: '#8b949e', border: '2px solid #484f58', top: '65%' }}
      />

      <div className="absolute right-3 pointer-events-none" style={{ top: '28%' }}>
        <span className="text-[9px] text-accent-purple leading-none">body</span>
      </div>
      <div className="absolute right-3 pointer-events-none" style={{ top: '58%' }}>
        <span className="text-[9px] text-text-muted leading-none">done</span>
      </div>
    </NodeBase>
  );
}
