# Step 3: Recommend from the books a user is currently reading

## Goal

Return five public books immediately from the user's current reading set. A
new `Start reading` action must affect the next request without retraining the
model.

The existing artifact already contains a TF-IDF content model and a cosine
similarity matrix. Reuse it to build a live user profile:

1. Load all source book IDs whose current status is `reading`.
2. Take the similarity row for each source book.
3. Average those rows to get one score per candidate book.
4. Exclude source books, non-public books, and duplicates.
5. Sort descending and return the first five.

This is content-based profile aggregation. It is a better first version than
collaborative filtering because the project does not yet have enough user-book
interactions for a stable collaborative model.

## 1. Add multi-book inference to the recommendation service

Edit `ml/recommendation-service/app/recommender.py` and add a method similar to:

```python
def recommend_for_books(
    self,
    book_ids: list[int],
    limit: int,
) -> list[Recommendation]:
    if self._similarity is None:
        raise RuntimeError("Recommendation model has not been loaded")

    source_positions = [
        self._book_positions[book_id]
        for book_id in dict.fromkeys(book_ids)
        if book_id in self._book_positions
    ]
    if not source_positions:
        return []

    scores = self._similarity[source_positions].mean(axis=0)
    excluded = set(source_positions)
    ranked_positions = np.argsort(scores)[::-1]

    recommendations = []
    for position in ranked_positions:
        position = int(position)
        score = float(scores[position])
        if position in excluded or not math.isfinite(score) or score < 0:
            continue

        recommendations.append(
            Recommendation(
                book_id=int(self._catalog[position]["book_id"]),
                score=score,
                model_version=self.model_version,
            )
        )
        if len(recommendations) == limit:
            break

    return recommendations
```

Then add a request schema and endpoint in
`ml/recommendation-service/app/main.py`:

```python
class UserProfileRecommendationIn(BaseModel):
    book_ids: list[int] = Field(min_length=1, max_length=100)
    limit: int = Field(default=5, ge=1, le=5)


@app.post(
    "/recommendations/profiles",
    response_model=list[RecommendationOut],
)
def get_profile_recommendations(
    request: UserProfileRecommendationIn,
) -> list[RecommendationOut]:
    items = engine.recommend_for_books(request.book_ids, request.limit)
    return [RecommendationOut(**item.__dict__) for item in items]
```

Do not let the recommendation service read the application database. The
backend owns authorization and sends only the IDs required for inference.

## 2. Collect the live reading profile in the backend

In `backend/app/routers/books.py`, query both sources:

- owned `Book` rows where `Book.user_id == current_user.id` and
  `Book.status == BookStatus.READING`;
- followed `BookReadingProgress` rows where
  `BookReadingProgress.user_id == current_user.id` and status is `reading`.

Deduplicate IDs before calling the model:

```python
owned_ids = {
    row[0]
    for row in db.query(Book.id).filter(
        Book.user_id == current_user.id,
        Book.status == BookStatus.READING,
    )
}
followed_ids = {
    row[0]
    for row in db.query(BookReadingProgress.book_id).filter(
        BookReadingProgress.user_id == current_user.id,
        BookReadingProgress.status == BookStatus.READING,
    )
}
source_ids = sorted(owned_ids | followed_ids)
```

Add a client function beside `fetch_recommendations` in
`backend/app/services/recommendation_client.py`. POST `book_ids` and `limit=5`
to `/recommendations/profiles`, keep the existing two-second timeout, and
validate every response item with `_parse_recommendation`.

Expose an authenticated endpoint such as:

```text
GET /api/books/recommendations/for-me?limit=5
```

Important: declare this fixed route before `GET /api/books/{book_id}` so
`recommendations` is not parsed as an integer book ID.

After model inference, filter candidates again in PostgreSQL using
`Book.visibility == BookVisibility.PUBLIC`, preserve model order, and exclude
all source IDs. Return at most five books. If there are no current books, or
the model service is unavailable, return an explicit fallback such as newest
public books and label the response source `catalog_fallback`.

Because source IDs are read on every request, pressing `Start reading` changes
the recommendation profile immediately; training is not part of this request.

## 3. Connect the frontend

Add `bookService.getRecommendationsForMe()` and call it on the public dashboard
or a dedicated `For you` section. Reload that query after a successful
`startReadingPublicBook` or progress update that changes status to/from
`reading`.

Render the same `BookCard` component and show the response source so fallback
results are not presented as model output.

## 4. Tests to write first

Recommendation engine tests:

- averaging two source rows produces the expected order;
- source books never appear in results;
- duplicate and unknown source IDs are safe;
- result count never exceeds five;
- an empty/unknown profile returns an empty list.

Backend tests:

- owned and followed reading books are both included as sources;
- completed/dropped progress is excluded;
- another user's progress is never included;
- private/restricted candidates are filtered out;
- the endpoint requires authentication;
- unavailable model service uses the documented fallback.

## 5. Evaluate and version the change

Do not use `mean_top_k_similarity` alone to claim recommendation quality. Add a
small offline holdout evaluation: for every profile with at least two reading
books, hide one book, build the profile from the others, and measure whether
the hidden book appears in the top five. Log at least:

- `hit_rate_at_5`;
- `recall_at_5`;
- `catalog_coverage_at_5`;
- number of evaluated profiles.

Add these metrics to `ml/reports/train_metrics.json` and MLflow. Bump
`train.model_version` in `ml/params.yaml` only after the tests and metrics are
acceptable.

Use the existing DVC pipeline safely:

```bash
dvc root
dvc status
dvc repro --dry train
dvc repro train
dvc metrics show
dvc status
```

Inspect the generated `dvc.lock`, metrics, and model artifact before committing
them. Do not hand-edit `dvc.lock`.

## Definition of done

- The endpoint returns exactly five when at least five valid candidates exist.
- A `Start reading` action affects the next recommendation request.
- Current source books and non-public candidates cannot be returned.
- Results remain available through a labeled fallback when the model is down.
- Engine, backend authorization/filtering, and frontend refresh behavior have
  automated tests.
- DVC reproduces the artifact and MLflow records the new parameters, metrics,
  and model version.
