"""Jeu SYNTHÉTIQUE : pour valider le pipeline, jamais comme preuve finale de détection."""
from pathlib import Path
import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parents[1] / "data"


def normal(n: int, rng: np.random.Generator) -> pd.DataFrame:
    rps = np.clip(rng.normal(22, 5, size=n), 2, 45)
    error = np.clip(rng.beta(1.4, 90, size=n), 0, 1)
    latency = np.clip(110 + rps * 2.8 + rng.normal(0, 23, size=n), 40, 400)
    cpu = np.clip(12 + rps * 1.05 + rng.normal(0, 7, size=n), 5, 85)
    return pd.DataFrame({
        "requests_per_second": rps,
        "error_rate": error,
        "latency_p95_ms": latency,
        "cpu_usage_percent": cpu,
    })


def perturbed(n: int, rng: np.random.Generator) -> pd.DataFrame:
    rps = np.clip(rng.normal(160, 20, size=n), 70, 300)
    error = np.clip(rng.normal(0.35, 0.08, size=n), 0.10, 0.8)
    latency = np.clip(rng.normal(2200, 400, size=n), 800, 4000)
    cpu = np.clip(rng.normal(89, 7, size=n), 50, 100)
    return pd.DataFrame({
        "requests_per_second": rps,
        "error_rate": error,
        "latency_p95_ms": latency,
        "cpu_usage_percent": cpu,
    })


def main():
    OUT.mkdir(exist_ok=True)
    rng = np.random.default_rng(42)
    normal(600, rng).to_csv(OUT / "normal_train.csv", index=False)
    normal(200, rng).to_csv(OUT / "normal_test.csv", index=False)
    perturbed(60, rng).to_csv(OUT / "incident_test.csv", index=False)
    print("Données synthétiques générées dans data/ (600 train, 200 normal test, 60 incident test)")

if __name__ == "__main__":
    main()
