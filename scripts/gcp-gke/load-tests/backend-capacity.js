import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    backend_capacity: {
      executor: 'constant-vus',
      vus: __ENV.VUS ? parseInt(__ENV.VUS) : 10,
      duration: __ENV.DURATION || '8m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
  tags: {
    tier: __ENV.VUS || '0',
    run_id: __ENV.RUN_ID || 'default',
  }
};

const BASE_URL = 'http://philobiblus-backend:8000';
const THINK_TIME = __ENV.THINK_TIME_SECONDS ? parseInt(__ENV.THINK_TIME_SECONDS) : 5;
const VUS = __ENV.VUS ? parseInt(__ENV.VUS) : 10;

export default function () {
  // Bỏ qua gửi request nếu tier 0 VU (Baseline)
  if (VUS === 0) {
    sleep(THINK_TIME);
    return;
  }

  const rand = Math.random();
  let res;
  let scenarioName = '';

  if (rand < 0.7) {
    scenarioName = 'public_list';
    res = http.get(`${BASE_URL}/api/books/public?limit=20`, { tags: { scenario: scenarioName } });
  } else if (rand < 0.9) {
    scenarioName = 'catalogue_search';
    res = http.get(`${BASE_URL}/api/books/public?search=history&limit=20`, { tags: { scenario: scenarioName } });
  } else {
    scenarioName = 'single_book';
    res = http.get(`${BASE_URL}/api/books/public/1`, { tags: { scenario: scenarioName } });
  }

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(THINK_TIME);
}
