import React, { useState } from 'react';
import {
  X, Trash2, ImageIcon, Camera, Play, ImageIcon as ImgIcon,
  Search, Clock, MousePointer, MoveRight, Type, Timer,
  RefreshCw, Terminal, Check, FolderOpen, Crosshair, Shuffle,
} from 'lucide-react';
import useStore from '../../store/index.js';
import useApi from '../../hooks/useApi.js';

const NODE_ICONS = {
  start: Play,
  match_screen: ImageIcon,
  find_element: Search,
  wait_for_image: Clock,
  tap: MousePointer,
  find_tap: Crosshair,
  random_tap: Shuffle,
  swipe: MoveRight,
  type_text: Type,
  wait: Timer,
  loop: RefreshCw,
  log: Terminal,
};

const NODE_COLORS = {
  start: '#22c55e',
  match_screen: '#3b82f6',
  find_element: '#3b82f6',
  wait_for_image: '#3b82f6',
  tap: '#a855f7',
  find_tap: '#a855f7',
  random_tap: '#a855f7',
  swipe: '#a855f7',
  type_text: '#a855f7',
  wait: '#f97316',
  loop: '#f97316',
  log: '#8b949e',
};

function FormRow({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-xs bg-bg-tertiary border border-border rounded px-2 py-1.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple transition-colors"
    />
  );
}

function NumberInput({ value, onChange, placeholder, min, max, step }) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        // Clearing the field gives parseFloat('') = NaN, which JSON turns
        // into null and the engine rejects — store undefined instead so
        // the engine falls back to the node's default
        const n = parseFloat(e.target.value);
        onChange(Number.isNaN(n) ? undefined : n);
      }}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step || 1}
      className="w-full text-xs bg-bg-tertiary border border-border rounded px-2 py-1.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple transition-colors"
    />
  );
}

function ImagePicker({ value, dataUrl, onChange }) {
  const projectImages = useStore((s) => s.projectImages);
  const fileName = value ? value.split(/[\\/]/).pop() : null;
  const [showGallery, setShowGallery] = useState(false);

  const handleBrowseFile = async () => {
    if (!window.electron) return;
    const filePath = await window.electron.dialogOpenFile();
    if (!filePath) return;
    const base64 = await window.electron.readFile(filePath);
    const ext = filePath.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    onChange({ path: filePath, dataUrl: `data:${mime};base64,${base64}` });
  };

  const handleSelectFromGallery = (img) => {
    onChange({ path: img.path, dataUrl: img.dataUrl });
    setShowGallery(false);
  };

  return (
    <div className="space-y-2">
      {/* Current selection preview */}
      {dataUrl && (
        <div className="relative">
          <img
            src={dataUrl}
            alt="reference"
            className="w-full rounded border border-accent-blue border-opacity-50 object-cover"
            style={{ maxHeight: 90 }}
          />
          <div className="absolute bottom-1 left-1 bg-black bg-opacity-60 rounded px-1.5 py-0.5">
            <span className="text-[9px] text-white truncate block" style={{ maxWidth: 140 }}>
              {fileName}
            </span>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => setShowGallery(!showGallery)}
          className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs transition-colors ${
            showGallery
              ? 'bg-accent-blue bg-opacity-15 border-accent-blue border-opacity-40 text-accent-blue'
              : 'bg-bg-tertiary border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          <ImgIcon size={11} />
          {fileName ? 'Change' : 'Choose image'}
        </button>
        <button
          onClick={handleBrowseFile}
          className="px-2 py-1.5 rounded border border-border bg-bg-tertiary hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          title="Browse file on disk"
        >
          <FolderOpen size={11} />
        </button>
      </div>

      {/* Gallery grid */}
      {showGallery && (
        <div className="border border-border rounded-lg overflow-hidden bg-bg-tertiary">
          {projectImages.length === 0 ? (
            <div className="px-3 py-4 text-xs text-text-muted text-center italic">
              No images yet — take a screenshot first
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 p-1.5 max-h-48 overflow-y-auto">
              {projectImages.map((img) => {
                const isSelected = img.path === value;
                return (
                  <button
                    key={img.path}
                    onClick={() => handleSelectFromGallery(img)}
                    className={`relative rounded overflow-hidden border transition-colors ${
                      isSelected
                        ? 'border-accent-blue'
                        : 'border-border hover:border-accent-blue border-opacity-50'
                    }`}
                    style={{ aspectRatio: '9/16' }}
                    title={img.name}
                  >
                    <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-accent-blue bg-opacity-25 flex items-center justify-center">
                        <Check size={14} className="text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SliderInput({ value, onChange, min = 0, max = 1, step = 0.05 }) {
  const v = value !== undefined ? value : 0.8;
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-accent-purple"
      />
      <span className="text-xs text-text-secondary w-8 text-right">{v.toFixed(2)}</span>
    </div>
  );
}

function NodeForm({ node, updateData }) {
  const { type, data } = node;

  if (type === 'start') {
    return (
      <FormRow label="Label">
        <TextInput
          value={data.label}
          onChange={(v) => updateData({ label: v })}
          placeholder="Start"
        />
      </FormRow>
    );
  }

  if (type === 'match_screen' || type === 'find_element') {
    return (
      <>
        <FormRow label="Label">
          <TextInput
            value={data.label}
            onChange={(v) => updateData({ label: v })}
            placeholder={type === 'match_screen' ? 'Match Screen' : 'Find Element'}
          />
        </FormRow>
        <FormRow label="Reference Image">
          <ImagePicker
            value={data.image_path}
            dataUrl={data.imageDataUrl}
            onChange={({ path, dataUrl }) => updateData({ image_path: path, imageDataUrl: dataUrl })}
          />
        </FormRow>
        <FormRow label={`Threshold (${(data.threshold || 0.8).toFixed(2)})`}>
          <SliderInput
            value={data.threshold}
            onChange={(v) => updateData({ threshold: v })}
          />
        </FormRow>
      </>
    );
  }

  if (type === 'wait_for_image') {
    return (
      <>
        <FormRow label="Label">
          <TextInput
            value={data.label}
            onChange={(v) => updateData({ label: v })}
            placeholder="Wait for Image"
          />
        </FormRow>
        <FormRow label="Reference Image">
          <ImagePicker
            value={data.image_path}
            dataUrl={data.imageDataUrl}
            onChange={({ path, dataUrl }) => updateData({ image_path: path, imageDataUrl: dataUrl })}
          />
        </FormRow>
        <FormRow label={`Threshold (${(data.threshold || 0.8).toFixed(2)})`}>
          <SliderInput
            value={data.threshold}
            onChange={(v) => updateData({ threshold: v })}
          />
        </FormRow>
        <FormRow label="Timeout (seconds)">
          <NumberInput
            value={data.timeout}
            onChange={(v) => updateData({ timeout: v })}
            placeholder="30"
            min={1}
          />
        </FormRow>
      </>
    );
  }

  if (type === 'tap') {
    return (
      <>
        <FormRow label="Label">
          <TextInput
            value={data.label}
            onChange={(v) => updateData({ label: v })}
            placeholder="Tap"
          />
        </FormRow>
        <div className="grid grid-cols-2 gap-2">
          <FormRow label="X">
            <NumberInput value={data.x} onChange={(v) => updateData({ x: v })} placeholder="0" min={0} />
          </FormRow>
          <FormRow label="Y">
            <NumberInput value={data.y} onChange={(v) => updateData({ y: v })} placeholder="0" min={0} />
          </FormRow>
        </div>
        <FormRow label="Duration (ms)">
          <NumberInput
            value={data.duration}
            onChange={(v) => updateData({ duration: v })}
            placeholder="100"
            min={1}
          />
        </FormRow>
      </>
    );
  }

  if (type === 'swipe') {
    return (
      <>
        <FormRow label="Label">
          <TextInput
            value={data.label}
            onChange={(v) => updateData({ label: v })}
            placeholder="Swipe"
          />
        </FormRow>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">From</div>
        <div className="grid grid-cols-2 gap-2">
          <FormRow label="X1">
            <NumberInput value={data.x1} onChange={(v) => updateData({ x1: v })} placeholder="0" min={0} />
          </FormRow>
          <FormRow label="Y1">
            <NumberInput value={data.y1} onChange={(v) => updateData({ y1: v })} placeholder="0" min={0} />
          </FormRow>
        </div>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">To</div>
        <div className="grid grid-cols-2 gap-2">
          <FormRow label="X2">
            <NumberInput value={data.x2} onChange={(v) => updateData({ x2: v })} placeholder="100" min={0} />
          </FormRow>
          <FormRow label="Y2">
            <NumberInput value={data.y2} onChange={(v) => updateData({ y2: v })} placeholder="100" min={0} />
          </FormRow>
        </div>
        <FormRow label="Duration (ms)">
          <NumberInput
            value={data.duration}
            onChange={(v) => updateData({ duration: v })}
            placeholder="300"
            min={1}
          />
        </FormRow>
      </>
    );
  }

  if (type === 'wait') {
    return (
      <>
        <FormRow label="Label">
          <TextInput
            value={data.label}
            onChange={(v) => updateData({ label: v })}
            placeholder="Wait"
          />
        </FormRow>
        <FormRow label="Duration (seconds)">
          <NumberInput
            value={data.seconds}
            onChange={(v) => updateData({ seconds: v })}
            placeholder="1"
            min={0.1}
            step={0.1}
          />
        </FormRow>
      </>
    );
  }

  if (type === 'loop') {
    const isInfinite = data.iterations === -1;
    return (
      <>
        <FormRow label="Label">
          <TextInput
            value={data.label}
            onChange={(v) => updateData({ label: v })}
            placeholder="Loop"
          />
        </FormRow>
        <FormRow label="Iterations">
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateData({ iterations: isInfinite ? 3 : -1 })}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors ${
                isInfinite
                  ? 'bg-accent-orange bg-opacity-15 border-accent-orange border-opacity-40 text-accent-orange'
                  : 'bg-bg-tertiary border-border text-text-muted hover:bg-bg-hover'
              }`}
            >
              <span className="text-base leading-none">∞</span>
              <span>Infinite</span>
            </button>
            {!isInfinite && (
              <NumberInput
                value={data.iterations}
                onChange={(v) => updateData({ iterations: Math.max(1, Math.floor(v)) })}
                placeholder="3"
                min={1}
              />
            )}
          </div>
        </FormRow>
      </>
    );
  }

  if (type === 'type_text') {
    return (
      <>
        <FormRow label="Label">
          <TextInput
            value={data.label}
            onChange={(v) => updateData({ label: v })}
            placeholder="Type Text"
          />
        </FormRow>
        <FormRow label="Text">
          <textarea
            value={data.text || ''}
            onChange={(e) => updateData({ text: e.target.value })}
            placeholder="Enter text to type..."
            rows={3}
            className="w-full text-xs bg-bg-tertiary border border-border rounded px-2 py-1.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple transition-colors resize-none"
          />
        </FormRow>
      </>
    );
  }

  if (type === 'find_tap') {
    return (
      <>
        <FormRow label="Label">
          <TextInput value={data.label} onChange={(v) => updateData({ label: v })} placeholder="Find & Tap" />
        </FormRow>
        <FormRow label="Reference Image">
          <ImagePicker
            value={data.image_path}
            dataUrl={data.imageDataUrl}
            onChange={({ path, dataUrl }) => updateData({ image_path: path, imageDataUrl: dataUrl })}
          />
        </FormRow>
        <FormRow label={`Threshold (${(data.threshold || 0.7).toFixed(2)})`}>
          <SliderInput value={data.threshold} onChange={(v) => updateData({ threshold: v })} />
        </FormRow>
        <FormRow label="Tap Duration (ms)">
          <NumberInput value={data.duration} onChange={(v) => updateData({ duration: v })} placeholder="100" min={1} />
        </FormRow>
      </>
    );
  }

  if (type === 'random_tap') {
    return (
      <>
        <FormRow label="Label">
          <TextInput value={data.label} onChange={(v) => updateData({ label: v })} placeholder="Random Tap" />
        </FormRow>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Area (top-left)</div>
        <div className="grid grid-cols-2 gap-2">
          <FormRow label="X1"><NumberInput value={data.x1} onChange={(v) => updateData({ x1: v })} placeholder="200" min={0} /></FormRow>
          <FormRow label="Y1"><NumberInput value={data.y1} onChange={(v) => updateData({ y1: v })} placeholder="250" min={0} /></FormRow>
        </div>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">Area (bottom-right)</div>
        <div className="grid grid-cols-2 gap-2">
          <FormRow label="X2"><NumberInput value={data.x2} onChange={(v) => updateData({ x2: v })} placeholder="1400" min={0} /></FormRow>
          <FormRow label="Y2"><NumberInput value={data.y2} onChange={(v) => updateData({ y2: v })} placeholder="850" min={0} /></FormRow>
        </div>
        <FormRow label="Tap Duration (ms)">
          <NumberInput value={data.duration} onChange={(v) => updateData({ duration: v })} placeholder="100" min={1} />
        </FormRow>
      </>
    );
  }

  if (type === 'log') {
    return (
      <>
        <FormRow label="Label">
          <TextInput
            value={data.label}
            onChange={(v) => updateData({ label: v })}
            placeholder="Log"
          />
        </FormRow>
        <FormRow label="Message">
          <textarea
            value={data.message || ''}
            onChange={(e) => updateData({ message: e.target.value })}
            placeholder="Log message..."
            rows={4}
            className="w-full text-xs bg-bg-tertiary border border-border rounded px-2 py-1.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple transition-colors resize-none font-mono"
          />
        </FormRow>
      </>
    );
  }

  return (
    <div className="text-xs text-text-muted italic">
      No properties for this node type.
    </div>
  );
}

export default function PropertiesPanel() {
  const selectedNode = useStore((s) => s.selectedNode);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const deleteNode = useStore((s) => s.deleteNode);
  const setSelectedNode = useStore((s) => s.setSelectedNode);
  const selectedDevice = useStore((s) => s.selectedDevice);
  const addLog = useStore((s) => s.addLog);

  const api = useApi();
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [takingScreenshot, setTakingScreenshot] = useState(false);

  if (!selectedNode) return null;

  const Icon = NODE_ICONS[selectedNode.type] || Terminal;
  const color = NODE_COLORS[selectedNode.type] || '#8b949e';

  const updateData = (patch) => {
    updateNodeData(selectedNode.id, patch);
  };

  const handleDelete = () => {
    deleteNode(selectedNode.id);
    setSelectedNode(null);
  };

  const handleScreenshot = async () => {
    if (!selectedDevice) {
      addLog({ level: 'warn', message: 'No device selected for screenshot' });
      return;
    }
    setTakingScreenshot(true);
    try {
      const base64 = await api.takeScreenshot(selectedDevice.id);
      setScreenshotUrl(`data:image/jpeg;base64,${base64}`);
    } catch (err) {
      addLog({ level: 'error', message: `Screenshot failed: ${err.message}` });
    } finally {
      setTakingScreenshot(false);
    }
  };

  return (
    <div
      className="w-72 shrink-0 bg-bg-secondary border-l border-border flex flex-col overflow-hidden slide-in"
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b border-border"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <Icon size={14} style={{ color }} />
        <span className="text-sm font-semibold text-text-primary flex-1 truncate">
          {selectedNode.data.label || selectedNode.type}
        </span>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-accent-red hover:bg-opacity-20 text-text-muted hover:text-accent-red transition-colors"
          title="Delete node"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={() => setSelectedNode(null)}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          title="Close"
        >
          <X size={13} />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <NodeForm node={selectedNode} updateData={updateData} />
      </div>

      {/* Screenshot preview */}
      <div className="border-t border-border px-4 py-3">
        <button
          onClick={handleScreenshot}
          disabled={takingScreenshot || !selectedDevice}
          className="w-full flex items-center justify-center gap-2 py-2 rounded bg-bg-tertiary border border-border hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={!selectedDevice ? 'Select a device first' : 'Take screenshot'}
        >
          <Camera size={12} />
          {takingScreenshot ? 'Capturing...' : 'Screenshot Preview'}
        </button>
        {screenshotUrl && (
          <div className="mt-2 relative">
            <img
              src={screenshotUrl}
              alt="screenshot"
              className="w-full rounded border border-border"
            />
            <button
              onClick={() => setScreenshotUrl(null)}
              className="absolute top-1 right-1 p-0.5 rounded bg-bg-secondary hover:bg-bg-hover text-text-muted"
            >
              <X size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
