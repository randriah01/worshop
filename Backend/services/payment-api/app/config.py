import os

DB_HOST = os.getenv("DB_HOST", "postgres")
DB_NAME = os.getenv("DB_NAME", "novapay")
DB_USER = os.getenv("DB_USER", "novapay")
DB_PASSWORD = os.getenv("DB_PASSWORD", "changeme")

# Secret partagé avec l'auth-service pour vérifier les JWT.
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-a-remplacer")

# Jeton interne : seuls la détection et la remédiation s'en servent
# pour déposer un incident. Les commerçants n'y ont jamais accès.
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN", "internal-dev-token")
