import React, { useState } from 'react';
import {
  Play, ImageIcon, Search, Clock, MousePointer, MoveRight,
  Type, Timer, RefreshCw, Terminal, RefreshCw as ScanIcon,
  Plus, Shield, ChevronDown, ChevronRight, Trash2, X,
  Crosshair, Shuffle,
} from 'lucide-react';
import useStore from '../../store/index.js';
import useApi from '../../hooks/useApi.js';

const PALETTE_ITEMS = [
  {
    category: 'Triggers',
    color: '#22c55e',
    items: [
      { type: 'start', label: 'Start', icon: Play },
    ],
  },
  {
    category: 'Conditions',
    color: '#3b82f6',
    items: [
      { type: 'match_screen', label: 'Match Screen', icon: ImageIcon },
      { type: 'find_element', label: 'Find Element', icon: Search },
      { type: 'wait_for_image', label: 'Wait for Image', icon: Clock },
    ],
  },
  {
    category: 'Actions',
    color: '#a855f7',
    items: [
      { type: 'tap',        label: 'Tap',         icon: MousePointer },
      { type: 'find_tap',   label: 'Find & Tap',  icon: Crosshair    },
      { type: 'random_tap', label: 'Random Tap',  icon: Shuffle      },
      { type: 'swipe',      label: 'Swipe',       icon: MoveRight    },
      { type: 'type_text',  label: 'Type Text',   icon: Type         },
    ],
  },
  {
    category: 'Control',
    color: '#f97316',
    items: [
      { type: 'wait', label: 'Wait', icon: Timer },
      { type: 'loop', label: 'Loop', icon: RefreshCw },
    ],
  },
  {
    category: 'Utility',
    color: '#8b949e',
    items: [
      { type: 'log', label: 'Log', icon: Terminal },
    ],
  },
];

function PaletteItem({ type, label, Icon, color }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData('application/emulatorflow-node', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2 px-3 py-1.5 rounded cursor-grab hover:bg-bg-hover transition-colors group"
      title={`Drag to add ${label}`}
    >
      <Icon size={13} style={{ color }} className="shrink-0" />
      <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
        {label}
      </span>
    </div>
  );
}

function DeviceItem({ device, isSelected, onClick }) {
  const statusColor =
    device.status === 'connected'
      ? '#22c55e'
      : device.status === 'connecting'
      ? '#eab308'
      : '#484f58';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-left transition-colors
        ${isSelected ? 'bg-bg-hover ring-1 ring-accent-purple' : 'hover:bg-bg-hover'}`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: statusColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-primary truncate">{device.name || device.id}</div>
        <div className="text-[10px] text-text-muted truncate">{device.id}</div>
      </div>
    </button>
  );
}

function ImageGallery() {
  const projectImages = useStore((s) => s.projectImages);
  const imagesPath = useStore((s) => s.imagesPath);
  const setProjectImages = useStore((s) => s.setProjectImages);
  const removeProjectImage = useStore((s) => s.removeProjectImage);
  const [preview, setPreview] = useState(null); // { name, dataUrl }
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!window.electron || !imagesPath) return;
    setRefreshing(true);
    const imgs = await window.electron.listImages(imagesPath);
    setProjectImages(imgs);
    setRefreshing(false);
  };

  const handleDelete = async (img, e) => {
    e.stopPropagation();
    if (!window.electron) return;
    await window.electron.deleteImage(img.path);
    removeProjectImage(img.path);
    if (preview?.path === img.path) setPreview(null);
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <span className="text-[10px] font-bold text-text-muted tracking-widest uppercase">
          Images
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          title="Refresh images"
        >
          <ScanIcon size={13} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="overflow-y-auto px-2 pb-2" style={{ maxHeight: '180px' }}>
        {projectImages.length === 0 ? (
          <div className="px-2 py-3 text-xs text-text-muted italic text-center">
            Take a screenshot to get started
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {projectImages.map((img) => (
              <div
                key={img.path}
                className="relative group cursor-pointer rounded overflow-hidden border border-border hover:border-accent-blue transition-colors"
                style={{ aspectRatio: '9/16' }}
                onClick={() => setPreview(img)}
                title={img.name}
              >
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => handleDelete(img, e)}
                  className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={8} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[8px] text-white truncate">{img.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="text-xs font-semibold text-text-primary truncate">{preview.name}</span>
              <button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-bg-hover text-text-muted">
                <X size={13} />
              </button>
            </div>
            <div className="overflow-auto p-3">
              <img src={preview.dataUrl} alt={preview.name} className="max-h-[80vh] w-auto rounded" style={{ maxWidth: 420 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeftSidebar() {
  const devices = useStore((s) => s.devices);
  const selectedDevice = useStore((s) => s.selectedDevice);
  const adBlockEnabled = useStore((s) => s.adBlockEnabled);
  const setSelectedDevice = useStore((s) => s.setSelectedDevice);
  const setDevices = useStore((s) => s.setDevices);
  const setAdBlockEnabled = useStore((s) => s.setAdBlockEnabled);
  const addLog = useStore((s) => s.addLog);

  const api = useApi();

  const [manualAddress, setManualAddress] = useState('');
  const [scanning, setScanning] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleScan = async () => {
    setScanning(true);
    addLog({ level: 'info', message: 'Scanning for devices...' });
    try {
      const result = await api.scanDevices();
      if (result.devices) setDevices(result.devices);
      addLog({ level: 'info', message: `Found ${result.devices?.length || 0} device(s)` });
    } catch (err) {
      addLog({ level: 'error', message: `Scan failed: ${err.message}` });
    } finally {
      setScanning(false);
    }
  };

  const handleAddDevice = async () => {
    if (!manualAddress.trim()) return;
    addLog({ level: 'info', message: `Connecting to ${manualAddress}...` });
    try {
      await api.connectDevice(manualAddress.trim());
      addLog({ level: 'info', message: `Connected to ${manualAddress}` });
      setManualAddress('');
    } catch (err) {
      addLog({ level: 'error', message: `Connect failed: ${err.message}` });
    }
  };

  const handleAdBlock = async () => {
    const newState = !adBlockEnabled;
    try {
      await api.setAdBlock(selectedDevice?.id, newState);
      setAdBlockEnabled(newState);
      addLog({ level: 'info', message: `Ad block ${newState ? 'enabled' : 'disabled'}` });
    } catch (err) {
      addLog({ level: 'error', message: `Ad block toggle failed: ${err.message}` });
    }
  };

  return (
    <div
      className="w-60 shrink-0 bg-bg-secondary border-r border-border flex flex-col overflow-hidden"
    >
      {/* Node palette */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 pb-1">
          <span className="text-[10px] font-bold text-text-muted tracking-widest uppercase">
            Node Palette
          </span>
        </div>

        {PALETTE_ITEMS.map(({ category, color, items }) => {
          const collapsed = collapsedCategories[category];
          return (
            <div key={category} className="mb-1">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-1.5 px-3 py-1 hover:bg-bg-hover transition-colors"
              >
                {collapsed ? (
                  <ChevronRight size={11} className="text-text-muted shrink-0" />
                ) : (
                  <ChevronDown size={11} className="text-text-muted shrink-0" />
                )}
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color }}
                >
                  {category}
                </span>
              </button>
              {!collapsed && (
                <div className="ml-2">
                  {items.map(({ type, label, icon: Icon }) => (
                    <PaletteItem
                      key={type}
                      type={type}
                      label={label}
                      Icon={Icon}
                      color={color}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Images gallery */}
      <ImageGallery />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Devices section */}
      <div className="h-56 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[10px] font-bold text-text-muted tracking-widest uppercase">
            Devices
          </span>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
            title="Scan for devices"
          >
            <ScanIcon
              size={13}
              className={scanning ? 'animate-spin' : ''}
            />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {devices.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted italic">
              No devices found
            </div>
          ) : (
            devices.map((device) => (
              <DeviceItem
                key={device.id}
                device={device}
                isSelected={selectedDevice?.id === device.id}
                onClick={() => setSelectedDevice(device)}
              />
            ))
          )}
        </div>

        {/* Manual add */}
        <div className="px-2 py-2 border-t border-border">
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="IP:port"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDevice()}
              className="flex-1 text-xs bg-bg-tertiary border border-border rounded px-2 py-1 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple"
            />
            <button
              onClick={handleAddDevice}
              className="p-1.5 rounded bg-bg-tertiary border border-border hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
              title="Connect"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Ad Block toggle */}
          <button
            onClick={handleAdBlock}
            className={`mt-1.5 w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors
              ${adBlockEnabled
                ? 'bg-accent-green bg-opacity-15 text-accent-green border border-accent-green border-opacity-30'
                : 'bg-bg-tertiary border border-border text-text-secondary hover:bg-bg-hover'
              }`}
          >
            <Shield size={11} />
            <span>Ad Block {adBlockEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
