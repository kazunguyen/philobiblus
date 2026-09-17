const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is required');
}

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL || '';
const PROMETHEUS_URL = import.meta.env.VITE_PROMETHEUS_URL || '';

export { API_URL, GRAFANA_URL, PROMETHEUS_URL };