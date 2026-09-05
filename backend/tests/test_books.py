def test_create_book(client, auth_headers):
    """Test creating a new book record."""
    payload = {
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "genre": "Software Engineering",
        "status": "reading",
        "rating": 5,
        "pages_total": 464,
        "pages_read": 120,
        "notes": "Excellent book on software craftsmanship.",
    }
    response = client.post("/api/books", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Clean Code"
    assert data["author"] == "Robert C. Martin"
    assert data["status"] == "reading"
    assert data["pages_read"] == 120
    assert "id" in data
    assert "user_id" in data


def test_get_books_empty(client, auth_headers):
    """Test getting books list when user has no books."""
    response = client.get("/api/books", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_get_book_stats(client, auth_headers):
    """Test aggregated reading statistics for the current user."""
    client.post(
        "/api/books",
        json={
            "title": "Reading Book",
            "author": "Author One",
            "genre": "Technology",
            "status": "reading",
            "pages_total": 200,
            "pages_read": 80,
            "rating": 4,
        },
        headers=auth_headers,
    )
    client.post(
        "/api/books",
        json={
            "title": "Completed Book",
            "author": "Author Two",
            "genre": "Fantasy",
            "status": "completed",
            "pages_total": 300,
            "pages_read": 300,
            "rating": 5,
        },
        headers=auth_headers,
    )

    response = client.get(
        "/api/books/stats",
        headers=auth_headers,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total_books"] == 2
    assert data["reading"] == 1
    assert data["completed"] == 1
    assert data["total_pages"] == 500
    assert data["total_pages_read"] == 380
    assert data["average_rating"] == 4.5
    assert data["reading_progress"] == 76.0


def test_get_books_with_filters_and_search(client, auth_headers):
    """Test getting books with status, genre filter, and search query."""
    # Create books with different attributes
    client.post(
        "/api/books",
        json={"title": "The Pragmatic Programmer", "author": "Andy Hunt", "genre": "Tech", "status": "completed"},
        headers=auth_headers,
    )
    client.post(
        "/api/books",
        json={"title": "Dune", "author": "Frank Herbert", "genre": "Sci-Fi", "status": "want_to_read"},
        headers=auth_headers,
    )

    # Filter by status
    res_status = client.get("/api/books?status=completed", headers=auth_headers)
    assert len(res_status.json()) == 1
    assert res_status.json()[0]["title"] == "The Pragmatic Programmer"

    # Search by author
    res_search = client.get("/api/books?search=Herbert", headers=auth_headers)
    assert len(res_search.json()) == 1
    assert res_search.json()[0]["title"] == "Dune"


def test_get_book_by_id(client, auth_headers):
    """Test retrieving a specific book by ID."""
    create_res = client.post(
        "/api/books",
        json={"title": "Atomic Habits", "author": "James Clear", "genre": "Tech", "status": "completed"},
        headers=auth_headers,
    )
    book_id = create_res.json()["id"]

    response = client.get(f"/api/books/{book_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Atomic Habits"


def test_get_book_not_found(client, auth_headers):
    """Test retrieving a non-existent book ID."""
    response = client.get("/api/books/9999", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "Book not found"


def test_update_book(client, auth_headers):
    """Test updating book reading progress and rating."""
    create_res = client.post(
        "/api/books",
        json={"title": "Deep Work", "author": "Cal Newport", "genre": "Tech", "status": "want_to_read", "pages_total": 300, "pages_read": 0},
        headers=auth_headers,
    )
    book_id = create_res.json()["id"]

    update_payload = {
        "status": "reading",
        "pages_read": 150,
        "rating": 4,
    }
    response = client.put(f"/api/books/{book_id}", json=update_payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "reading"
    assert data["pages_read"] == 150
    assert data["rating"] == 4
    assert data["title"] == "Deep Work"  # Unmodified fields remain intact


def test_delete_book(client, auth_headers):
    """Test deleting a book record."""
    create_res = client.post(
        "/api/books",
        json={"title": "To Delete Book", "author": "Unknown Author", "genre": "Tech"},
        headers=auth_headers,
    )
    book_id = create_res.json()["id"]

    del_res = client.delete(f"/api/books/{book_id}", headers=auth_headers)
    assert del_res.status_code == 204

    # Verify book is deleted
    get_res = client.get(f"/api/books/{book_id}", headers=auth_headers)
    assert get_res.status_code == 404


def test_user_cannot_access_other_users_book(client, auth_headers, second_auth_headers):
    """Critical test: verify user isolation so User A cannot read, update, or delete User B's book."""
    # User 1 creates a book
    create_res = client.post(
        "/api/books",
        json={"title": "Private Diary Book", "author": "User One", "genre": "Tech"},
        headers=auth_headers,
    )
    book_id = create_res.json()["id"]

    # User 2 tries to GET User 1's book -> 404
    get_res = client.get(f"/api/books/{book_id}", headers=second_auth_headers)
    assert get_res.status_code == 404

    # User 2 tries to UPDATE User 1's book -> 404
    update_res = client.put(f"/api/books/{book_id}", json={"title": "Hacked Title"}, headers=second_auth_headers)
    assert update_res.status_code == 404

    # User 2 tries to DELETE User 1's book -> 404
    del_res = client.delete(f"/api/books/{book_id}", headers=second_auth_headers)
    assert del_res.status_code == 404

def test_get_public_books_returns_books_from_all_users(
    client,
    auth_headers,
    second_auth_headers,
):
    """Test public book list includes books from multiple users."""
    client.post(
        "/api/books",
        json={
            "title": "Clean Architecture",
            "author": "Robert C. Martin",
            "genre": "Tech",
        },
        headers=auth_headers,
    )
    client.post(
        "/api/books",
        json={
            "title": "Dune",
            "author": "Frank Herbert",
            "genre": "Science Fiction",
        },
        headers=second_auth_headers,
    )

    response = client.get("/api/books/public")

    assert response.status_code == 200
    titles = {book["title"] for book in response.json()}
    assert "Clean Architecture" in titles
    assert "Dune" in titles


def test_get_public_books_with_filters_and_search(
    client,
    auth_headers,
    second_auth_headers,
):
    """Test public book list supports genre filtering and title/author search."""
    client.post(
        "/api/books",
        json={
            "title": "The Pragmatic Programmer",
            "author": "Andy Hunt",
            "genre": "Tech",
        },
        headers=auth_headers,
    )
    client.post(
        "/api/books",
        json={
            "title": "Dune Messiah",
            "author": "Frank Herbert",
            "genre": "Science Fiction",
        },
        headers=second_auth_headers,
    )

    genre_response = client.get("/api/books/public?genre=Science")
    search_response = client.get("/api/books/public?search=Herbert")

    assert genre_response.status_code == 200
    assert len(genre_response.json()) == 1
    assert genre_response.json()[0]["title"] == "Dune Messiah"

    assert search_response.status_code == 200
    assert len(search_response.json()) == 1
    assert search_response.json()[0]["author"] == "Frank Herbert"


def test_book_visibility_controls_public_and_shared_access(client, auth_headers):
    """Test public, restricted, and private visibility boundaries."""
    public_response = client.post(
        "/api/books",
        json={"title": "Public Book", "author": "Author", "genre": "Tech", "visibility": "public"},
        headers=auth_headers,
    )
    restricted_response = client.post(
        "/api/books",
        json={"title": "Restricted Book", "author": "Author", "genre": "Tech", "visibility": "restricted"},
        headers=auth_headers,
    )
    private_response = client.post(
        "/api/books",
        json={"title": "Private Book", "author": "Author", "genre": "Tech", "visibility": "private"},
        headers=auth_headers,
    )

    assert public_response.status_code == 201
    assert restricted_response.status_code == 201
    assert private_response.status_code == 201
    restricted = restricted_response.json()
    assert restricted["share_token"]
    assert public_response.json()["share_token"] is None
    assert private_response.json()["share_token"] is None

    public_books = client.get("/api/books/public")
    public_titles = {book["title"] for book in public_books.json()}
    assert "Public Book" in public_titles
    assert "Restricted Book" not in public_titles
    assert "Private Book" not in public_titles

    shared_response = client.get(f"/api/books/shared/{restricted['share_token']}")
    assert shared_response.status_code == 200
    assert shared_response.json()["title"] == "Restricted Book"
    assert "share_token" not in shared_response.json()

    private_id = private_response.json()["id"]
    assert client.get(f"/api/books/public/{private_id}").status_code == 404


def test_restricted_share_token_is_created_and_revoked_on_update(client, auth_headers):
    """Test share token lifecycle when changing visibility."""
    create_response = client.post(
        "/api/books",
        json={"title": "Visibility Changes", "author": "Author", "genre": "Tech"},
        headers=auth_headers,
    )
    book_id = create_response.json()["id"]

    restricted_response = client.put(
        f"/api/books/{book_id}",
        json={"visibility": "restricted"},
        headers=auth_headers,
    )
    token = restricted_response.json()["share_token"]
    assert token

    private_response = client.put(
        f"/api/books/{book_id}",
        json={"visibility": "private"},
        headers=auth_headers,
    )
    assert private_response.json()["share_token"] is None
    assert client.get(f"/api/books/shared/{token}").status_code == 404
