import time

import psycopg2
from psycopg2.pool import SimpleConnectionPool

from . import config

_pool = None


def init_pool():
    """Initialise le pool de connexions, en attendant que la base démarre."""
    global _pool
    last_error = None
    for _ in range(30):
        try:
            _pool = SimpleConnectionPool(
                1,
                10,
                host=config.DB_HOST,
                dbname=config.DB_NAME,
                user=config.DB_USER,
                password=config.DB_PASSWORD,
            )
            return
        except Exception as e:
            last_error = e
            time.sleep(2)
    raise RuntimeError(f"Base de données indisponible : {last_error}")


def get_conn():
    if _pool is None:
        raise RuntimeError("Pool de connexions non initialisé")
    return _pool.getconn()


def put_conn(conn):
    """Rend la connexion au pool après avoir soldé toute transaction ouverte."""
    if _pool is None:
        return
    try:
        conn.rollback()
    except Exception:
        pass
    _pool.putconn(conn)


def db_ok() -> bool:
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        put_conn(conn)
        return True
    except Exception:
        return False
