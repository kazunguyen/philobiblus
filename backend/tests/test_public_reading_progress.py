from app.models import BookReadingProgress, ReadingHistory


def create_public_book(client, headers, **overrides):
    payload = {
        "title": "Shared Reading Book",
        "author": "Author",
        "genre": "Technology",
        "status": "reading",
        "pages_total": 300,
    }
    payload.update(overrides)
    response = client.post("/api/books", json=payload, headers=headers)
    assert response.status_code == 201
    return response.json()


def test_reader_can_start_and_update_personal_progress(
    client,
    auth_headers,
    second_auth_headers,
    db_session,
):
    book = create_public_book(client, auth_headers)

    start_response = client.post(
        f"/api/books/public/{book['id']}/reading-progress",
        headers=second_auth_headers,
    )

    assert start_response.status_code == 201
    assert start_response.json()["status"] == "reading"
    assert start_response.json()["pages_read"] == 0

    detail_response = client.get(
        f"/api/books/public/{book['id']}",
        headers=second_auth_headers,
    )
    detail = detail_response.json()
    assert detail["active_reader_count"] == 2
    assert detail["my_reading_progress"]["status"] == "reading"

    profile = client.get("/api/users/testuser").json()
    profile_book = next(item for item in profile["books"] if item["id"] == book["id"])
    assert profile_book["active_reader_count"] == 2

    update_response = client.put(
        f"/api/books/public/{book['id']}/reading-progress",
        json={
            "pages_read": 120,
            "chapters_read": 4.5,
            "volume": 1,
            "status": "completed",
        },
        headers=second_auth_headers,
    )

    assert update_response.status_code == 200
    progress = update_response.json()
    assert progress["pages_read"] == 120
    assert progress["chapters_read"] == 4.5
    assert progress["status"] == "completed"
    assert progress["date_finished"] is not None

    detail = client.get(f"/api/books/public/{book['id']}").json()
    assert detail["active_reader_count"] == 1
    assert db_session.query(ReadingHistory).filter_by(
        book_id=book["id"],
        user_id=progress["user_id"],
    ).count() == 1


def test_start_reading_is_idempotent_and_owner_uses_existing_editor(
    client,
    auth_headers,
    second_auth_headers,
    db_session,
):
    book = create_public_book(client, auth_headers, status="want_to_read")
    url = f"/api/books/public/{book['id']}/reading-progress"

    first_response = client.post(url, headers=second_auth_headers)
    second_response = client.post(url, headers=second_auth_headers)
    owner_response = client.post(url, headers=auth_headers)

    assert first_response.status_code == 201
    assert second_response.status_code == 201
    assert first_response.json()["id"] == second_response.json()["id"]
    assert owner_response.status_code == 400
    assert db_session.query(BookReadingProgress).count() == 1
    assert client.get(f"/api/books/public/{book['id']}").json()[
        "active_reader_count"
    ] == 1


def test_private_and_restricted_books_require_their_expected_access(
    client,
    auth_headers,
    second_auth_headers,
):
    private_book = create_public_book(
        client,
        auth_headers,
        visibility="private",
    )
    restricted_book = create_public_book(
        client,
        auth_headers,
        visibility="restricted",
    )

    assert client.post(
        f"/api/books/public/{private_book['id']}/reading-progress",
        headers=second_auth_headers,
    ).status_code == 404
    assert client.post(
        f"/api/books/public/{restricted_book['id']}/reading-progress",
        headers=second_auth_headers,
    ).status_code == 404

    shared_response = client.post(
        f"/api/books/public/{restricted_book['id']}/reading-progress",
        params={"share_token": restricted_book["share_token"]},
        headers=second_auth_headers,
    )
    assert shared_response.status_code == 201

    shared_detail = client.get(
        f"/api/books/shared/{restricted_book['share_token']}",
        headers=second_auth_headers,
    ).json()
    assert shared_detail["active_reader_count"] == 2
    assert shared_detail["my_reading_progress"]["status"] == "reading"


def test_reader_cannot_exceed_known_page_total(
    client,
    auth_headers,
    second_auth_headers,
):
    book = create_public_book(client, auth_headers, pages_total=100)
    url = f"/api/books/public/{book['id']}/reading-progress"
    client.post(url, headers=second_auth_headers)

    response = client.put(
        url,
        json={"pages_read": 101},
        headers=second_auth_headers,
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Pages read cannot exceed the book's total pages"
