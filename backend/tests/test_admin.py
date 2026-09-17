import pytest

from app.auth import get_password_hash

from app.models import Book, Follow, Friendship, FriendshipStatus, Review, User


@pytest.fixture
def admin_headers(client, db_session):
    admin = User(
        username="siteadmin",
        email="siteadmin@example.com",
        hashed_password=get_password_hash("adminpassword"),
        is_admin=True,
    )
    db_session.add(admin)
    db_session.commit()

    response = client.post(
        "/api/auth/login",
        data={"username": "siteadmin", "password": "adminpassword"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_book(client, headers, title, visibility="public"):
    response = client.post(
        "/api/books",
        json={
            "title": title,
            "author": "Admin test author",
            "genre": "Technology",
            "visibility": visibility,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_admin_endpoints_require_an_admin_role(client, auth_headers, admin_headers):
    denied = client.get("/api/admin/users", headers=auth_headers)
    assert denied.status_code == 403

    allowed = client.get("/api/admin/users", headers=admin_headers)
    assert allowed.status_code == 200
    assert any(user["username"] == "testuser" for user in allowed.json())


def test_admin_can_view_every_book_and_private_book_details(
    client,
    auth_headers,
    admin_headers,
):
    private_book = create_book(client, auth_headers, "Private resource", "private")

    list_response = client.get("/api/admin/books", headers=admin_headers)
    assert list_response.status_code == 200
    listed = next(item for item in list_response.json() if item["id"] == private_book["id"])
    assert listed["visibility"] == "private"
    assert listed["owner"]["username"] == "testuser"

    detail_response = client.get(
        f"/api/admin/books/{private_book['id']}",
        headers=admin_headers,
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["book"]["title"] == "Private resource"


def test_admin_can_reset_password_and_lock_account(
    client,
    auth_headers,
    admin_headers,
):
    reset_response = client.put(
        "/api/admin/users/testuser/password",
        json={"password": "replacement-password"},
        headers=admin_headers,
    )
    assert reset_response.status_code == 200

    login_response = client.post(
        "/api/auth/login",
        data={"username": "testuser", "password": "replacement-password"},
    )
    assert login_response.status_code == 200

    lock_response = client.put(
        "/api/admin/users/testuser/status",
        json={"is_active": False},
        headers=admin_headers,
    )
    assert lock_response.status_code == 200
    assert lock_response.json()["is_active"] is False

    locked_login = client.post(
        "/api/auth/login",
        data={"username": "testuser", "password": "replacement-password"},
    )
    assert locked_login.status_code == 400


def test_admin_deletion_cleans_related_data_and_retains_active_reader_book(
    client,
    auth_headers,
    second_auth_headers,
    admin_headers,
    db_session,
):
    retained_book = create_book(client, auth_headers, "Keep for active reader")
    removed_book = create_book(client, auth_headers, "Remove with account", "private")
    other_book = create_book(client, second_auth_headers, "Other owner's book")

    progress_response = client.post(
        f"/api/books/public/{retained_book['id']}/reading-progress",
        headers=second_auth_headers,
    )
    assert progress_response.status_code == 201

    review_response = client.post(
        f"/api/books/{other_book['id']}/reviews",
        json={"rating": 5, "comment": "Removed with its reviewer"},
        headers=auth_headers,
    )
    assert review_response.status_code == 201

    target = db_session.query(User).filter_by(username="testuser").one()
    reader = db_session.query(User).filter_by(username="seconduser").one()
    target_id = target.id
    db_session.add(Follow(follower_id=target.id, following_id=reader.id))
    first_id, second_id = sorted((target.id, reader.id))
    db_session.add(
        Friendship(
            user_one_id=first_id,
            user_two_id=second_id,
            requested_by_id=target.id,
            status=FriendshipStatus.PENDING,
        )
    )
    db_session.commit()

    delete_response = client.delete(
        "/api/admin/users/testuser",
        headers=admin_headers,
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["retained_book_count"] == 1

    assert db_session.query(User).filter_by(username="testuser").first() is None
    kept = db_session.query(Book).filter_by(id=retained_book["id"]).one()
    assert kept.user_id is None
    public_book_response = client.get(
        f"/api/books/public/{retained_book['id']}",
        headers=second_auth_headers,
    )
    assert public_book_response.status_code == 200
    assert public_book_response.json()["owner"] is None
    assert db_session.query(Book).filter_by(id=removed_book["id"]).first() is None
    assert db_session.query(Review).filter_by(id=review_response.json()["id"]).first() is None
    assert db_session.query(Follow).filter(
        (Follow.follower_id == target_id) | (Follow.following_id == target_id)
    ).count() == 0
    assert db_session.query(Friendship).filter(
        (Friendship.user_one_id == target_id)
        | (Friendship.user_two_id == target_id)
        | (Friendship.requested_by_id == target_id)
    ).count() == 0
