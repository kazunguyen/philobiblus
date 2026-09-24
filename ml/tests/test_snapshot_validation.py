import json

import numpy as np
import pandas as pd
import pytest

from snapshot_catalog import canonical_catalog_sha256
from validate_snapshot import compare_catalogs, validate_catalog


def catalog(rows):
    return pd.DataFrame(rows, columns=[
        "book_id", "title", "author", "genre", "tags", "cover_url", "created_at", "updated_at"
    ]).astype({"book_id": "int64"})


def test_logical_snapshot_hash_is_stable_when_row_order_changes():
    rows = [
        [2, "B", "Author", "genre", json.dumps(["tag"]), None, "2024-01-01", "2024-01-02"],
        [1, "A", "Author", "genre", None, None, "2024-01-01", "2024-01-02"],
    ]
    assert canonical_catalog_sha256(catalog(rows)) == canonical_catalog_sha256(catalog(list(reversed(rows))))


def test_logical_snapshot_hash_normalizes_postgresql_array_tags():
    array_tags = catalog([[1, "A", "Author", "genre", np.array(["fiction"]), None, "2024-01-01", "2024-01-02"]])
    list_tags = catalog([[1, "A", "Author", "genre", ["fiction"], None, "2024-01-01", "2024-01-02"]])
    assert canonical_catalog_sha256(array_tags) == canonical_catalog_sha256(list_tags)


def test_validation_rejects_malformed_tags():
    rows = [[1, "A", "Author", "genre", '{"not": "a list"}', None, "2024-01-01", "2024-01-02"]]
    with pytest.raises(SystemExit):
        validate_catalog(catalog(rows))


def test_validation_accepts_postgresql_array_tags():
    rows = [[1, "A", "Author", "genre", np.array(["fiction", "award"]), None, "2024-01-01", "2024-01-02"]]
    assert validate_catalog(catalog(rows))["total_books"] == 1


def test_validation_reports_catalog_delta():
    old = catalog([[1, "A", "Author", "genre", "", None, "2024-01-01", "2024-01-01"]])
    current = catalog([
        [1, "A revised", "Author", "genre", "", None, "2024-01-01", "2024-01-02"],
        [2, "B", "Author", "genre", "", None, "2024-01-02", "2024-01-02"],
    ])
    assert compare_catalogs(current, old) == {"new_books": 1, "updated_books": 1, "removed_books": 0}


def test_valid_catalog_returns_duplicate_diagnostic():
    data = catalog([
        [1, "A", "Author", "genre", "", None, "2024-01-01", "2024-01-01"],
        [2, "A", "Author", "genre", "", None, "2024-01-01", "2024-01-01"],
    ])
    assert validate_catalog(data)["duplicates_title_author"] == 2
