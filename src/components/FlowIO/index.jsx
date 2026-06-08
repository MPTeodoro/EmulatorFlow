import React, { useState } from 'react';
import { X, Copy, Download, Upload, Wand2, Check, AlertCircle, Loader } from 'lucide-react';
import useStore from '../../store/index.js';

const TABS = ['Export', 'Import', 'AI Generate'];

const SYSTEM_PROMPT = `You are a workflow generator for EmulatorFlow, a desktop app for automating Android mobile games via ADB.

Generate a workflow as JSON based on the user's description.

NODE TYPES:
- "start": entry point. handles: out→
- "loop": repeats body. data: {label, iterations: number (-1=infinite)}. handles: →in, body→, done→
- "match_screen": screenshot vs image. data: {label, image_path, threshold:0.0-1.0}. handles: →in, match→, no_match→
- "find_tap": find image on screen and tap it. data: {label, image_path, threshold, duration}. handles: →in, found→, not_found→
- "random_tap": tap random spot. data: {label, x1, y1, x2, y2, duration}. handles: →in, out→
- "tap": tap fixed coords. data: {label, x, y, duration}. handles: →in, out→
- "swipe": drag gesture. data: {label, x1, y1, x2, y2, duration}. handles: →in, out→
- "wait": pause. data: {label, seconds}. handles: →in, out→
- "wait_for_image": poll until image appears. data: {label, image_path, threshold, timeout}. handles: →in, found→, timeout→
- "log": log message. data: {label, message}. handles: →in, out→

RULES:
- Always start with a "start" node
- Use loop iterations:-1 for infinite bots
- image_path = descriptive filename the user will replace later: "home.png", "enemy.png", etc.
- Position nodes left→right. Start at x:100,y:250. Space ~260px horizontal, ~150px vertical. Branch outputs go below each other.
- Node ids: "n1","n2"... Edge ids: "e1","e2"...
- Edges need: id, source, sourceHandle, target, targetHandle

Return ONLY the raw JSON object, no markdown, no explanation:
{"nodes":[...],"edges":[...]}`;

function generateId() {
  return `node_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
}

export default function FlowIO({ onClose, initialTab = 0 }) {
  const workflow      = useStore((s) => s.workflow);
  const setNodes      = useStore((s) => s.setNodes);
  const setEdges      = useStore((s) => s.setEdges);
  const addLog        = useStore((s) => s.addLog);

  const [tab, setTab]           = useState(initialTab);
  const [copied, setCopied]     = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);

  // AI state
  const [prompt, setPrompt]       = useState('');
  const [apiKey, setApiKey]       = useState(() => localStorage.getItem('ef_anthropic_key') || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState('');
  const [aiResult, setAiResult]   = useState('');

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportJson = JSON.stringify({ nodes: workflow.nodes, edges: workflow.edges }, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([exportJson], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'workflow.emflow.json';
    a.click();
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = (jsonStr) => {
    setImportError('');
    setImportSuccess(false);
    try {
      const parsed = JSON.parse(jsonStr || importText);
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        throw new Error('JSON must have "nodes" and "edges" arrays.');
      }

      // Remap IDs to avoid collisions with existing nodes
      const idMap = {};
      const newNodes = parsed.nodes.map((n) => {
        const newId = generateId();
        idMap[n.id] = newId;
        return { ...n, id: newId, selected: false };
      });
      const newEdges = parsed.edges.map((e, i) => ({
        ...e,
        id: `imported_e${i}_${Date.now()}`,
        source: idMap[e.source] || e.source,
        target: idMap[e.target] || e.target,
      }));

      setNodes([...workflow.nodes, ...newNodes]);
      setEdges([...workflow.edges, ...newEdges]);
      setImportSuccess(true);
      addLog({ level: 'info', message: `Imported ${newNodes.length} nodes, ${newEdges.length} edges` });
      setTimeout(onClose, 800);
    } catch (err) {
      setImportError(err.message);
    }
  };

  // ── AI Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim()) { setAiError('Describe the bot you want to build.'); return; }
    if (!apiKey.trim()) { setAiError('Enter your Anthropic API key.'); return; }

    localStorage.setItem('ef_anthropic_key', apiKey);
    setAiLoading(true);
    setAiError('');
    setAiResult('');

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      setAiResult(text);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleImportAiResult = () => {
    handleImport(aiResult);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div
        className="bg-bg-secondary border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: 560, maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border shrink-0">
          <div className="flex gap-1">
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  tab === i
                    ? 'bg-accent-purple text-white'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* ── EXPORT ── */}
          {tab === 0 && (
            <>
              <p className="text-xs text-text-muted">
                Copy or download the current workflow JSON to share or back up.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-semibold transition-colors ${
                    copied
                      ? 'bg-accent-green bg-opacity-15 border-accent-green border-opacity-40 text-accent-green'
                      : 'bg-bg-tertiary border-border text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-bg-tertiary text-text-secondary hover:bg-bg-hover text-xs font-semibold transition-colors"
                >
                  <Download size={12} />
                  Download .json
                </button>
              </div>
              <textarea
                readOnly
                value={exportJson}
                rows={16}
                className="w-full text-xs bg-bg-tertiary border border-border rounded px-3 py-2 text-text-secondary font-mono resize-none focus:outline-none"
              />
            </>
          )}

          {/* ── IMPORT ── */}
          {tab === 1 && (
            <>
              <p className="text-xs text-text-muted">
                Paste a workflow JSON (exported from EmulatorFlow or generated by AI) to add its nodes to the canvas.
              </p>
              <textarea
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportError(''); setImportSuccess(false); }}
                placeholder={'{\n  "nodes": [...],\n  "edges": [...]\n}'}
                rows={14}
                className="w-full text-xs bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary font-mono resize-none focus:outline-none focus:border-accent-purple transition-colors"
              />
              {importError && (
                <div className="flex items-center gap-1.5 text-xs text-accent-red">
                  <AlertCircle size={12} /> {importError}
                </div>
              )}
              {importSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-accent-green">
                  <Check size={12} /> Imported successfully!
                </div>
              )}
              <button
                onClick={() => handleImport()}
                disabled={!importText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-accent-purple hover:bg-opacity-80 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Upload size={12} />
                Import to canvas
              </button>
            </>
          )}

          {/* ── AI GENERATE ── */}
          {tab === 2 && (
            <>
              <p className="text-xs text-text-muted">
                Describe the bot you want to build in plain text. The AI generates the workflow and you import it.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full text-xs bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple transition-colors"
                />
                <p className="text-[10px] text-text-muted">Stored locally in your browser. Never sent to our servers.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Describe your bot
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Example: Create an infinite loop that takes a screenshot, checks if it's the home screen, if yes taps the play button, otherwise waits 2 seconds and tries again."
                  rows={5}
                  className="w-full text-xs bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple transition-colors resize-none"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={aiLoading || !prompt.trim() || !apiKey.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-accent-purple hover:bg-opacity-80 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {aiLoading ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
                {aiLoading ? 'Generating...' : 'Generate Workflow'}
              </button>

              {aiError && (
                <div className="flex items-start gap-1.5 text-xs text-accent-red">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" /> {aiError}
                </div>
              )}

              {aiResult && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Generated JSON — review before importing
                    </label>
                    <textarea
                      value={aiResult}
                      onChange={(e) => setAiResult(e.target.value)}
                      rows={10}
                      className="w-full text-xs bg-bg-tertiary border border-border rounded px-3 py-2 text-text-primary font-mono resize-none focus:outline-none focus:border-accent-purple transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleImportAiResult}
                    className="flex items-center gap-1.5 px-4 py-2 rounded bg-accent-green bg-opacity-15 hover:bg-opacity-25 border border-accent-green border-opacity-40 text-accent-green text-xs font-semibold transition-colors"
                  >
                    <Upload size={12} />
                    Import to canvas
                  </button>
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
