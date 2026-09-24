from mlflow_model import quality_gate


BASE = {"evaluated_profiles": 100, "hit_rate_at_5": 0.10, "catalog_coverage_at_5": 0.20}
POLICY = {
    "min_evaluated_profiles": 100,
    "min_hit_rate_at_5": 0.01,
    "min_catalog_coverage_at_5": 0.01,
    "max_hit_rate_regression": 0.02,
}


def test_quality_gate_rejects_insufficient_interactions():
    assert quality_gate({**BASE, "evaluated_profiles": 99}, POLICY, None) == "insufficient_data"


def test_quality_gate_rejects_regression_from_champion():
    assert quality_gate(BASE, POLICY, {"hit_rate_at_5": 0.13}) == "rejected_regression"


def test_quality_gate_accepts_candidate_within_regression_budget():
    assert quality_gate(BASE, POLICY, {"hit_rate_at_5": 0.12}) == "passed"
