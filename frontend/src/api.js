const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8010';
const USE_API = String(import.meta.env.VITE_USE_API).toLowerCase() === 'true';

export function isApiEnabled() {
  return USE_API;
}

export async function fetchDashboardStatus(signal) {
  const response = await fetch(`${API_BASE_URL}/status`, { signal });

  if (!response.ok) {
    throw new Error(`Status request failed: ${response.status}`);
  }

  const payload = await response.json();

  return {
    occupancy: String(payload.occupancy || 'EMPTY').toUpperCase(),
    personCount: Number(payload.person_count ?? 0),
    confidence: Number(payload.confidence ?? 0),
    inferenceMs: Number(payload.inference_ms ?? 0),
    acState: String(payload.ac_state || payload.acState || 'OFF').toUpperCase(),
    temperature: payload.temperature == null ? null : Number(payload.temperature),
    rawOccupancy: String(payload.raw_occupancy || payload.occupancy || 'EMPTY').toUpperCase(),
    controlPending: Boolean(payload.control_pending),
    pendingSeconds: Number(payload.pending_seconds || 0),
    controlReason: payload.control_reason || '',
    runtimeSeconds: Number(payload.runtime_seconds || payload.runtimeSeconds || 0),
    timestamp: payload.timestamp || new Date().toISOString(),
    edgeConnected: payload.edge_connected ?? true,
    cameraActive: payload.camera_active ?? true,
    modelName: payload.model_name || 'Classroom Person Detector (YOLO11n ONNX)',
    deviceName: payload.device_name || 'Local Edge Laptop',
    error: payload.error || '',
    snapshotUrl: `${API_BASE_URL}/snapshot.jpg?t=${Date.now()}`,
  };
}

export async function uploadInferenceVideo(file) {
  const body = new FormData();
  body.append('video', file);
  const response = await fetch(`${API_BASE_URL}/video`, {
    method: 'POST',
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `Video upload failed: ${response.status}`);
  }
  return payload;
}
