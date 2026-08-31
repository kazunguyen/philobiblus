def test_create_review(client, auth_headers):
    book_response = client.post(
        "/api/books",
        json={
            "title": "Clean Code",
            "author": "Robert C. Martin",
            "genre": "Technology",
        },
        headers=auth_headers,
    )

    book_id = book_response.json()["id"]

    response = client.post(
        f"/api/books/{book_id}/reviews",
        json={
            "rating": 5,
            "comment": "Excellent book.",
        },
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["rating"] == 5
    assert data["comment"] == "Excellent book."
    assert data["reviewer"]["username"] == "testuser"


def test_get_book_reviews_public(client, auth_headers):
    book_response = client.post(
        "/api/books",
        json={
            "title": "Dune",
            "author": "Frank Herbert",
            "genre": "Science Fiction",
        },
        headers=auth_headers,
    )

    book_id = book_response.json()["id"]

    client.post(
        f"/api/books/{book_id}/reviews",
        json={"rating": 4, "comment": "Great world building."},
        headers=auth_headers,
    )

    response = client.get(f"/api/books/{book_id}/reviews")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["rating"] == 4


def test_review_rating_validation(client, auth_headers):
    book_response = client.post(
        "/api/books",
        json={
            "title": "Invalid Rating Book",
            "author": "Author",
            "genre": "Drama",
        },
        headers=auth_headers,
    )

    book_id = book_response.json()["id"]

    response = client.post(
        f"/api/books/{book_id}/reviews",
        json={"rating": 6, "comment": "Invalid rating."},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_only_review_owner_can_delete(
    client,
    auth_headers,
    second_auth_headers,
):
    book_response = client.post(
        "/api/books",
        json={
            "title": "Shared Review Book",
            "author": "Author",
            "genre": "Drama",
        },
        headers=auth_headers,
    )

    book_id = book_response.json()["id"]

    review_response = client.post(
        f"/api/books/{book_id}/reviews",
        json={"rating": 3, "comment": "Average."},
        headers=second_auth_headers,
    )

    review_id = review_response.json()["id"]

    forbidden_delete = client.delete(
        f"/api/reviews/{review_id}",
        headers=auth_headers,
    )
    assert forbidden_delete.status_code == 404

    owner_delete = client.delete(
        f"/api/reviews/{review_id}",
        headers=second_auth_headers,
    )
    assert owner_delete.status_code == 204