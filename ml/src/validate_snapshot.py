import argparse
import json
import sys
from pathlib import Path

import pandas as pd


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot-dir", required=True)
    parser.add_argument("--champion-manifest", required=False)
    args = parser.parse_args()

    snapshot_dir = Path(args.snapshot_dir)
    catalog_path = snapshot_dir / "catalog.parquet"
    manifest_path = snapshot_dir / "manifest.json"

    if not catalog_path.is_file() or not manifest_path.is_file():
        print("Missing catalog.parquet or manifest.json", file=sys.stderr)
        sys.exit(1)

    df = pd.read_parquet(catalog_path)
    
    # Validation bắt buộc:
    # - book_id là integer duy nhất, không null.
    if df["book_id"].isnull().any():
        print("Validation failed: book_id contains nulls", file=sys.stderr)
        sys.exit(1)
        
    if not pd.api.types.is_integer_dtype(df["book_id"]):
        print("Validation failed: book_id is not integer", file=sys.stderr)
        sys.exit(1)
        
    if not df["book_id"].is_unique:
        print("Validation failed: book_id is not unique", file=sys.stderr)
        sys.exit(1)

    # - title và author sau trim không rỗng.
    df["title"] = df["title"].astype(str).str.strip()
    df["author"] = df["author"].astype(str).str.strip()
    
    if (df["title"] == "").any() or (df["title"].str.lower() == "nan").any():
        print("Validation failed: title contains empty values", file=sys.stderr)
        sys.exit(1)
        
    if (df["author"] == "").any() or (df["author"].str.lower() == "nan").any():
        print("Validation failed: author contains empty values", file=sys.stderr)
        sys.exit(1)

    # - Catalog không rỗng.
    if len(df) == 0:
        print("Validation failed: catalog is empty", file=sys.stderr)
        sys.exit(1)

    # Báo cáo số sách duplicate title-author
    duplicates = df.duplicated(subset=["title", "author"], keep=False).sum()

    report = {
        "status": "passed",
        "total_books": len(df),
        "duplicates_title_author": int(duplicates)
    }

    # - Catalog không giảm quá 20% so với champion
    if args.champion_manifest:
        champion_path = Path(args.champion_manifest)
        if champion_path.is_file():
            with open(champion_path) as f:
                champion = json.load(f)
                champion_count = champion.get("row_count", 0)
                if champion_count > 0:
                    drop_ratio = (champion_count - len(df)) / champion_count
                    if drop_ratio > 0.2:
                        print(f"Validation failed: Catalog dropped by {drop_ratio*100:.1f}% (>20%)", file=sys.stderr)
                        sys.exit(1)

    report_path = snapshot_dir / "validation_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
        
    print(json.dumps(report))
    sys.exit(0)

if __name__ == "__main__":
    main()
