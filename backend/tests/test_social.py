def register_and_login(client, username, email, password):
    """Register a test account and return its authentication headers."""
    register_response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/auth/login",
        data={
            "username": username,
            "password": password,
        },
    )
    assert login_response.status_code == 200

    return {
        "Authorization": (
            f"Bearer {login_response.json()['access_token']}"
        ),
    }


def test_follow_and_unfollow_user(
    client,
    auth_headers,
    second_auth_headers,
):
    follow_response = client.post(
        "/api/users/seconduser/follow",
        headers=auth_headers,
    )

    assert follow_response.status_code == 201
    assert follow_response.json()["following_id"] != 0

    relationship_response = client.get(
        "/api/users/seconduser/relationship",
        headers=auth_headers,
    )
    assert relationship_response.status_code == 200
    assert relationship_response.json()["is_following"] is True
    assert relationship_response.json()["friendship"] is None

    followers_response = client.get("/api/users/seconduser/followers")
    assert followers_response.status_code == 200
    assert followers_response.json()[0]["username"] == "testuser"

    unfollow_response = client.delete(
        "/api/users/seconduser/follow",
        headers=auth_headers,
    )
    assert unfollow_response.status_code == 204


def test_cannot_follow_self_or_follow_twice(
    client,
    auth_headers,
    second_auth_headers,
):
    self_follow_response = client.post(
        "/api/users/testuser/follow",
        headers=auth_headers,
    )
    assert self_follow_response.status_code == 400

    first_follow_response = client.post(
        "/api/users/seconduser/follow",
        headers=auth_headers,
    )
    assert first_follow_response.status_code == 201

    duplicate_follow_response = client.post(
        "/api/users/seconduser/follow",
        headers=auth_headers,
    )
    assert duplicate_follow_response.status_code == 409


def test_friend_request_can_be_accepted_by_recipient(
    client,
    auth_headers,
    second_auth_headers,
):
    request_response = client.post(
        "/api/users/seconduser/friend-requests",
        headers=auth_headers,
    )

    assert request_response.status_code == 201
    friendship_id = request_response.json()["id"]
    assert request_response.json()["status"] == "pending"
    assert request_response.json()["requested_by"]["username"] == "testuser"

    incoming_response = client.get(
        "/api/users/me/friend-requests?direction=incoming",
        headers=second_auth_headers,
    )
    assert incoming_response.status_code == 200
    assert incoming_response.json()[0]["id"] == friendship_id

    accept_response = client.put(
        f"/api/friendships/{friendship_id}/accept",
        headers=second_auth_headers,
    )
    assert accept_response.status_code == 200
    assert accept_response.json()["status"] == "accepted"


def test_friend_request_sender_cannot_accept_own_request(
    client,
    auth_headers,
    second_auth_headers,
):
    request_response = client.post(
        "/api/users/seconduser/friend-requests",
        headers=auth_headers,
    )
    friendship_id = request_response.json()["id"]

    accept_response = client.put(
        f"/api/friendships/{friendship_id}/accept",
        headers=auth_headers,
    )

    assert accept_response.status_code == 403


def test_non_member_cannot_remove_friendship(
    client,
    auth_headers,
    second_auth_headers,
):
    request_response = client.post(
        "/api/users/seconduser/friend-requests",
        headers=auth_headers,
    )
    friendship_id = request_response.json()["id"]

    third_auth_headers = register_and_login(
        client,
        "thirduser",
        "thirduser@example.com",
        "password789",
    )

    remove_response = client.delete(
        f"/api/friendships/{friendship_id}",
        headers=third_auth_headers,
    )

    assert remove_response.status_code == 403