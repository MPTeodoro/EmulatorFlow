import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';
import useStore from '../store/index.js';

export default function StartNode({ id, data, selected }) {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const isActive = activeNodeId === id;

  return (
    <div
      className={`
        node-start relative flex flex-col items-center justify-center
        bg-bg-secondary border border-border rounded-full
        px-8 py-4 min-w-[140px] cursor-default
        ${selected ? 'ring-2 ring-accent-purple' : ''}
        ${isActive ? 'node-active' : ''}
      `}
      style={{ minWidth: 140 }}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-accent-green flex items-center justify-center">
          <Play size={12} className="text-white ml-0.5" />
        </div>
        <span className="font-bold text-sm text-accent-green tracking-wider">
          {data.label || 'START'}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          background: '#22c55e',
          border: '2px solid #16a34a',
          width: 10,
          height: 10,
        }}
      />
    </div>
  );
}
