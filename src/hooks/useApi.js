const BASE_URL = 'http://localhost:8765';

async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }
  return response.json();
}

export function useApi() {
  const scanDevices = () =>
    apiFetch('/devices/scan', { method: 'POST' });

  const connectDevice = (address) =>
    apiFetch('/devices/connect', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });

  const disconnectDevice = (address) =>
    apiFetch('/devices/disconnect', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });

  const getDevices = () => apiFetch('/devices');

  const takeScreenshot = async (device) => {
    const result = await apiFetch('/screenshot', {
      method: 'POST',
      body: JSON.stringify({ device }),
    });
    return result.data;
  };

  const setAdBlock = (device, enable) =>
    apiFetch('/adblocker', {
      method: 'POST',
      body: JSON.stringify({ device, enable }),
    });

  // Returns { run_id, status, name }
  const startExecution = (workflow, device) =>
    apiFetch('/execute/start', {
      method: 'POST',
      body: JSON.stringify({
        workflow: {
          id: workflow.id || 'unsaved',
          name: workflow.name || 'Untitled',
          nodes: workflow.nodes,
          edges: workflow.edges,
          assets_path: workflow.assets_path || '',
        },
        device,
      }),
    });

  // runId = null stops ALL runs
  const stopExecution = (runId = null) =>
    apiFetch('/execute/stop', {
      method: 'POST',
      body: JSON.stringify({ run_id: runId }),
    });

  // runId = null pauses first active run
  const pauseExecution = (runId = null) =>
    apiFetch('/execute/pause', {
      method: 'POST',
      body: JSON.stringify({ run_id: runId }),
    });

  const listRuns = () => apiFetch('/execute/runs');

  const healthCheck = () => apiFetch('/health');

  return {
    scanDevices,
    connectDevice,
    disconnectDevice,
    getDevices,
    takeScreenshot,
    setAdBlock,
    startExecution,
    stopExecution,
    pauseExecution,
    listRuns,
    healthCheck,
  };
}

export default useApi;
