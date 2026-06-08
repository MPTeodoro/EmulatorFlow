import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Crosshair } from 'lucide-react';
import useStore from '../store/index.js';
import NodeBase, { NodeHeader, NodeProp } from './NodeBase.jsx';

export default function FindTapNode({ id, data, selected }) {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const nodeResults  = useStore((s) => s.nodeResults);
  const isActive     = activeNodeId === id;
  const result       = nodeResults[id];
  const imageName    = data.image_path ? data.image_path.split(/[\\/]/).pop() : null;

  return (
    <NodeBase selected={selected} isActive={isActive} categoryClass="node-action">
      <NodeHeader
        icon={<Crosshair size={13} />}
        label={data.label || 'Find & Tap'}
        bgColor="rgba(168, 85, 247, 0.15)"
        textColor="#a855f7"
      />

      <div className="px-3 py-2 space-y-1 bg-bg-primary bg-opacity-40">
        {data.image_path ? (
          <div className="flex items-center gap-2">
            {data.imageDataUrl ? (
              <img src={data.imageDataUrl} alt="ref" className="w-12 h-8 object-cover rounded border border-border" />
            ) : (
              <div className="w-12 h-8 bg-bg-tertiary rounded border border-border flex items-center justify-center">
                <Crosshair size={12} className="text-text-muted" />
              </div>
            )}
            <span className="text-xs text-text-secondary truncate max-w-[120px]" title={imageName}>
              {imageName}
            </span>
          </div>
        ) : (
          <div className="text-xs text-text-muted italic">No image selected</div>
        )}
        <NodeProp label="Threshold" value={data.threshold !== undefined ? data.threshold : 0.8} />
        {result && (
          <div className={`text-xs font-semibold ${result.output === 'found' ? 'text-accent-green' : 'text-accent-red'}`}>
            {result.output === 'found' ? '✓ Found & tapped' : '✗ Not found'}
          </div>
        )}
      </div>

      <Handle type="target"  position={Position.Left}  id="in"        style={{ background: '#8b949e', border: '2px solid #484f58', top: '50%' }} />
      <Handle type="source"  position={Position.Right} id="found"     style={{ background: '#22c55e', border: '2px solid #16a34a', top: '35%' }} />
      <Handle type="source"  position={Position.Right} id="not_found" style={{ background: '#ef4444', border: '2px solid #dc2626', top: '65%' }} />

      <div className="absolute right-3 pointer-events-none" style={{ top: '28%' }}>
        <span className="text-[9px] text-accent-green leading-none">found</span>
      </div>
      <div className="absolute right-3 pointer-events-none" style={{ top: '58%' }}>
        <span className="text-[9px] text-accent-red leading-none">not found</span>
      </div>
    </NodeBase>
  );
}
