def test_request_id_is_generated_and_returned(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]


def test_request_id_is_preserved_when_supplied(client):
    response = client.get("/health", headers={"X-Request-ID": "request-from-client"})

    assert response.headers["X-Request-ID"] == "request-from-client"
