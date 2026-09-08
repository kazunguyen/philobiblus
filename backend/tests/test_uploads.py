import httpx


def test_upload_cover_returns_imgbb_url(client, auth_headers, monkeypatch):
    monkeypatch.setenv("IMGBB_API", "test-imgbb-key")

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json():
            return {
                "success": True,
                "data": {"url": "https://i.ibb.co/example/cover.jpg"},
            }

    def fake_post(url, data, timeout):
        assert url == "https://api.imgbb.com/1/upload"
        assert data["key"] == "test-imgbb-key"
        assert data["image"]
        assert timeout == 30.0
        return FakeResponse()

    monkeypatch.setattr(httpx, "post", fake_post)

    response = client.post(
        "/api/uploads/cover",
        files={"file": ("cover.jpg", b"fake-image", "image/jpeg")},
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.json() == {"url": "https://i.ibb.co/example/cover.jpg"}


def test_upload_cover_rejects_unsupported_type(client, auth_headers):
    response = client.post(
        "/api/uploads/cover",
        files={"file": ("cover.txt", b"not-an-image", "text/plain")},
        headers=auth_headers,
    )

    assert response.status_code == 415
