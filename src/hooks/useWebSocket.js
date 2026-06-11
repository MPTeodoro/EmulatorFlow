import { useEffect, useRef } from 'react';
import useStore from '../store/index.js';

const WS_URL = 'ws://localhost:8765/ws';
const RECONNECT_INTERVAL = 3000;

export default function useWebSocket() {
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // Actions only — getState() avoids subscribing the host component (App)
  // to the whole store, which re-rendered the entire tree on every log line
  const {
    setWsConnected,
    addLog,
    setDevices,
    updateRunStatus,
    setRunNodeResult,
    removeRun,
    syncRuns,
  } = useStore.getState();

  const handleMessage = (msg) => {
    // Always pull fresh state inside callbacks to avoid stale closures
    const state = useStore.getState();

    switch (msg.type) {

      case 'log':
        addLog({
          level: msg.level || 'info',
          message: msg.message || '',
          timestamp: msg.timestamp,
        });
        break;

      case 'execution_state': {
        const runId = msg.run_id;
        if (runId) {
          updateRunStatus(runId, msg.status, msg.node_id);
        } else {
          // Fallback — no run_id (shouldn't happen with v0.2.0 engine)
          state.setExecutionStatus?.(msg.status);
          state.setActiveNodeId?.(msg.node_id);
        }
        break;
      }

      case 'node_result': {
        const runId = msg.run_id;
        if (runId && msg.node_id) {
          setRunNodeResult(runId, msg.node_id, { output: msg.output, data: msg.data || {} });
        } else if (msg.node_id) {
          useStore.getState().setNodeResult(msg.node_id, { output: msg.output, data: msg.data || {} });
        }
        break;
      }

      case 'run_ended': {
        const runId = msg.run_id;
        if (runId) {
          addLog({ level: 'info', message: `Run ${runId} completed` });
          removeRun(runId);
        }
        break;
      }

      case 'runs_sync': {
        if (Array.isArray(msg.runs)) {
          syncRuns(msg.runs);
        }
        break;
      }

      case 'device_update':
        if (Array.isArray(msg.devices)) {
          setDevices(msg.devices);
        }
        break;

      default:
        break;
    }
  };

  const connect = () => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setWsConnected(true);
        addLog({ level: 'info', message: 'Connected to EmulatorFlow engine' });
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setWsConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };
    } catch (err) {
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (!mountedRef.current) return;
    if (reconnectTimerRef.current) return;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, RECONNECT_INTERVAL);
  };

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
    };
  }, []);

  return wsRef;
}
