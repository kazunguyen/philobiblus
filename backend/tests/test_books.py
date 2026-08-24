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