"""Validate a catalog snapshot before any training resources are consumed."""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = {"book_id", "title", "author", "genre", "tags", "cover_url", "created_at", "updated_at"}


def fail(message: str) -> None:
    print(f"Validation failed: {message}", file=sys.stderr)
    raise SystemExit(1)


def _non_empty(series: pd.Series) -> bool:
    values = series.fillna("").astype(str).str.strip()
    return bool((values == "").any() or (values.str.lower() == "nan").any())


def _invalid_tags(value: object) -> bool:
    # Pandas/Parquet materializes PostgreSQL ARRAY columns as ndarray while a
    # direct SQL read returns a list. Normalize both before scalar checks.
    if hasattr(value, "tolist"):
        value = value.tolist()  # type: ignore[union-attr]
    if isinstance(value, (list, tuple)):
        return not all(isinstance(item, str) for item in value)
    if value is None:
        return False
    if not isinstance(value, str):
        try:
            missing = pd.isna(value)
            if getattr(missing, "ndim", 0) == 0 and bool(missing):
                return False
        except (TypeError, ValueError):
            pass
        return True
    if value == "":
        return False
    try:
        if bool(pd.isna(value)):
            return False
    except (TypeError, ValueError):
        return True
    try:
        decoded = json.loads(value)
    except json.JSONDecodeError:
        return False  # Legacy comma-separated tags remain supported.
    return not isinstance(decoded, list) or not all(isinstance(item, str) for item in decoded)


def validate_catalog(catalog: pd.DataFrame) -> dict[str, int]:
    missing = REQUIRED_COLUMNS - set(catalog.columns)
    if missing:
        fail(f"missing columns: {sorted(missing)}")
    if catalog.empty:
        fail("catalog is empty")
    if catalog["book_id"].isnull().any() or not pd.api.types.is_integer_dtype(catalog["book_id"]):
        fail("book_id must be a non-null integer")
    if not catalog["book_id"].is_unique:
        fail("book_id must be unique")
    for column in ("title", "author"):
        if _non_empty(catalog[column]):
            fail(f"{column} contains an empty value")
    if catalog["tags"].map(_invalid_tags).any():
        fail("tags must be null, text, or a JSON list of text values")
    return {
        "total_books": int(len(catalog)),
        "duplicates_title_author": int(catalog.duplicated(subset=["title", "author"], keep=False).sum()),
    }


def compare_catalogs(current: pd.DataFrame, champion: pd.DataFrame | None) -> dict[str, int]:
    if champion is None:
        return {"new_books": 0, "updated_books": 0, "removed_books": 0}
    current_index = current.set_index("book_id")
    champion_index = champion.set_index("book_id")
    shared_ids = current_index.index.intersection(champion_index.index)
    fields = ["title", "author", "genre", "tags", "cover_url", "updated_at"]
    changed = (current_index.loc[shared_ids, fields].fillna("").astype(str) !=
               champion_index.loc[shared_ids, fields].fillna("").astype(str)).any(axis=1)
    return {
        "new_books": int(len(current_index.index.difference(champion_index.index))),
        "updated_books": int(changed.sum()),
        "removed_books": int(len(champion_index.index.difference(current_index.index))),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot-dir", required=True)
    parser.add_argument("--champion-manifest")
    parser.add_argument("--champion-catalog")
    parser.add_argument("--max-catalog-drop-ratio", type=float, default=0.20)
    args = parser.parse_args()
    snapshot_dir = Path(args.snapshot_dir)
    catalog_path, manifest_path = snapshot_dir / "catalog.parquet", snapshot_dir / "manifest.json"
    if not catalog_path.is_file() or not manifest_path.is_file():
        fail("catalog.parquet or manifest.json is missing")
    catalog = pd.read_parquet(catalog_path)
    report = {"status": "passed", **validate_catalog(catalog)}
    champion_catalog, champion_count = None, 0
    if args.champion_manifest and Path(args.champion_manifest).is_file():
        champion_count = int(json.loads(Path(args.champion_manifest).read_text(encoding="utf-8")).get("row_count", 0))
    if args.champion_catalog and Path(args.champion_catalog).is_file():
        champion_catalog = pd.read_parquet(args.champion_catalog)
        champion_count = len(champion_catalog)
    if champion_count:
        drop_ratio = (champion_count - len(catalog)) / champion_count
        if drop_ratio > args.max_catalog_drop_ratio:
            fail(f"catalog dropped {drop_ratio:.1%}; limit is {args.max_catalog_drop_ratio:.1%}")
    report.update(compare_catalogs(catalog, champion_catalog))
    report["champion_row_count"] = int(champion_count)
    (snapshot_dir / "validation_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
