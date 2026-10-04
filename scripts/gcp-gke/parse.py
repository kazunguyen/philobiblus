import json
import glob
import os

tiers = [10, 25, 50, 100, 110, 120, 125, 130, 140, 150]
for t in tiers:
    folders = sorted(glob.glob(f"artifacts/load-tests/tier_{t}_*"), reverse=True)
    if folders:
        f = os.path.join(folders[0], "k6-summary.json")
        try:
            with open(f) as file:
                data = json.load(file)
            req_rate = data["metrics"]["http_reqs"]["rate"]
            med = data["metrics"]["http_req_duration"]["med"]
            p95 = data["metrics"]["http_req_duration"]["p(95)"]
            # p99 might not be explicitly there, check keys
            p99 = data["metrics"]["http_req_duration"].get("p(99)", 0)
            err = data["metrics"]["http_req_failed"]["value"]
            print(f"| {t} | {req_rate:.1f} | {med:.1f} | {p95:.1f} | {p99:.1f} | {err*100:.2f}% |")
        except Exception as e:
            print(f"| {t} | Error {e}")
