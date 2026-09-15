import argparse
import json
from pathlib import Path

import pandas as pd


def tags_to_text(value: object) -> str:
    if pd.isna(value):
        return ""

    try:
        decoded = json.loads(str(value))
        if isinstance(decoded, list):
            return " ".join(map(str, decoded))
    except (json.JSONDecodeError, TypeError):
        pass

    return str(value)


parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()

books = pd.read_csv(args.input)

required = {"book_id", "title", "author", "genre", "tags", "cover_url"}
missing = required - set(books.columns)
if missing:
    raise ValueError(f"Missing columns: {sorted(missing)}")

for column in ["title", "author", "genre"]:
    books[column] = books[column].fillna("").astype(str).str.strip()

books["book_id"] = books["book_id"].astype(str)
books["tags_text"] = books["tags"].apply(tags_to_text)
books["feature_text"] = (
    books["title"] + " "
    + books["author"] + " "
    + books["genre"] + " "
    + books["tags_text"]
).str.lower()

output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
books.to_csv(output, index=False)