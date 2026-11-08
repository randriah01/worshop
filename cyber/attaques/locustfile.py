import random
from locust import HttpUser, task, between

JWT_TOKEN = ""   # colle un token ici pour viser le paiement authentifie

class AttaquantNovaPay(HttpUser):
    wait_time = between(0.0, 0.02)

    @task(8)
    def attaquer_paiement(self):
        headers = {}
        if JWT_TOKEN:
            headers["Authorization"] = "Bearer " + JWT_TOKEN
        body = {"amount": random.randint(1, 100), "currency": "EUR", "card": "4242424242424242"}
        self.client.post("/api/transactions", json=body, headers=headers, name="ATTAQUE /api/transactions")

    @task(2)
    def marteler_health(self):
        self.client.get("/api/health", name="FLOOD /api/health")
