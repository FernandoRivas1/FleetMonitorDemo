"""HTTP-level tests for the public API (see the API table in the root README)."""


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_vehicles_have_position_status_and_driver(client):
    vehicles = client.get("/vehicles").json()
    assert len(vehicles) == 15
    for v in vehicles:
        assert v["status"] in {"available", "rented", "maintenance"}
        assert v["plate"]


def test_simulate_advances_the_cycle(client):
    first = client.post("/simulate").json()
    second = client.post("/simulate").json()
    assert second["cycle"] == first["cycle"] + 1
    assert first["readings_created"] == 15


def test_telemetry_history_respects_limit(client):
    for _ in range(3):
        client.post("/simulate")
    vehicle_id = client.get("/vehicles").json()[0]["id"]

    history = client.get(f"/vehicles/{vehicle_id}/telemetry", params={"limit": 2}).json()

    assert len(history) == 2


def test_unresolved_only_filter(client):
    alerts = client.get("/alerts", params={"unresolved_only": "true"}).json()
    assert all(not a["resolved"] for a in alerts)


def test_assistant_answers_without_an_api_key(client):
    res = client.post("/assistant/ask", json={"question": "How many vehicles need maintenance?"})
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "rule_based"
    assert "maintenance" in body["answer"].lower()


def test_assistant_answers_about_a_city(client):
    city = client.get("/vehicles").json()[0]["base_city"]
    answer = client.post("/assistant/ask", json={"question": f"What's happening in {city}?"}).json()["answer"]
    assert answer.startswith(f"In {city} there are")
