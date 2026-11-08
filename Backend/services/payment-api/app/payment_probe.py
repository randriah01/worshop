"""NovaPay: sonde metier ponctuelle, sans remediations ni actions SOAR.

A executer dans un environnement NovaPay de test, avec un compte marchand dedie.
Par defaut, ne cree aucune transaction. --execute cree UNE transaction fictive.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import getpass
import json
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import uuid


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def request_json(method: str, url: str, payload=None, token=None, *, headers=None):
    body = json.dumps(payload).encode('utf-8') if payload is not None else None
    h = {'Accept': 'application/json'}
    if payload is not None:
        h['Content-Type'] = 'application/json'
    if token:
        h['Authorization'] = 'Bearer ' + token
    h.update(headers or {})
    request = Request(url, data=body, headers=h, method=method)
    start = time.monotonic()
    try:
        with urlopen(request, timeout=8) as response:
            content = response.read(1_000_000)
            status = response.status
    except HTTPError as exc:
        # Ne jamais afficher le corps de reponse ou le token dans les traces.
        raise RuntimeError(f'HTTP {exc.code} sur {method} {url.split("?")[0]}') from None
    except URLError as exc:
        raise RuntimeError(f'Connexion impossible sur {url.split("?")[0]}: {type(exc.reason).__name__}') from None
    try:
        data = json.loads(content) if content else None
    except ValueError:
        raise RuntimeError(f'Reponse non JSON sur {method} {url.split("?")[0]}') from None
    return status, data, round((time.monotonic() - start) * 1000, 2)


def connection():
    # Utilise uniquement la configuration DB deja presente dans le conteneur API.
    from app import db
    db.init_pool()
    return db


def check_db(db, transaction_id=None, merchant_id=None, key=None, amount=None):
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            if transaction_id is None:
                cur.execute('SELECT 1')
                return cur.fetchone()[0] == 1
            cur.execute(
                'SELECT id, merchant_id, amount_cents, status, idempotency_key '
                'FROM transactions WHERE merchant_id = %s AND idempotency_key = %s',
                (merchant_id, key),
            )
            rows = cur.fetchall()
            valid = (len(rows) == 1 and str(rows[0][0]) == str(transaction_id)
                     and rows[0][2] == amount
                     and rows[0][3] == 'validated')
            return {'verified': valid, 'matching_rows': len(rows),
                    'status': rows[0][3] if rows else None}
    finally:
        db.put_conn(conn)


def read_balance(db, merchant_id):
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT balance_cents FROM merchants WHERE id = %s',
                        (merchant_id,))
            row = cur.fetchone()
            if row is None:
                raise RuntimeError('Marchand introuvable en base')
            return row[0]
    finally:
        db.put_conn(conn)


def bearer_token(login_url):
    if login_url:
        username = input('Identifiant du marchand de TEST : ').strip()
        password = getpass.getpass('Mot de passe (non affiche) : ')
        _, result, _ = request_json('POST', login_url, {'login': username, 'password': password})
        if not isinstance(result, dict) or not result.get('access_token'):
            raise RuntimeError(
                "Le login n'a pas fourni de JWT utilisable. Si MFA/visage est requis, "
                'terminer le parcours normal puis utiliser la saisie securisee du JWT.'
            )
        return result['access_token']
    token = getpass.getpass('JWT marchand de TEST (saisie masquee) : ').strip()
    if not token:
        raise RuntimeError('JWT absent')
    return token


def find_in_api(api, token, transaction_id):
    # Parcours borne et explicite ; ne conclut pas sur une simple reponse HTTP 200.
    for offset in (0, 500, 1000):
        _, rows, _ = request_json('GET', api + '/transactions?' + urlencode(
            {'limit': 500, 'offset': offset}), token=token)
        if not isinstance(rows, list):
            raise RuntimeError('GET /transactions ne retourne pas une liste')
        for row in rows:
            if str(row.get('id')) == str(transaction_id):
                return row
        if len(rows) < 500:
            break
    return None


def main():
    parser = argparse.ArgumentParser(description='Sonde paiement NovaPay, sans SOAR')
    parser.add_argument('--api-url', default='http://payment-api:8080')
    parser.add_argument('--login-url', help='URL exacte de POST /login, facultative')
    parser.add_argument('--execute', action='store_true',
                        help='Autorise explicitement un paiement fictif')
    parser.add_argument('--verify-replay', action='store_true',
                        help='Teste un rejeu avec la meme cle et le meme montant')
    parser.add_argument('--amount-cents', type=int, default=1)
    args = parser.parse_args()
    if args.amount_cents < 1 or args.amount_cents > 100:
        parser.error('Montant de test autorise: de 1 a 100 centimes')
    if args.verify_replay and not args.execute:
        parser.error('--verify-replay exige --execute')

    api = args.api_url.rstrip('/')
    result = {'probe_id': 'np-' + uuid.uuid4().hex[:12],
              'timestamp_utc': timestamp(),
              'mode': 'ONE_SHOT_TEST' if args.execute else 'PREFLIGHT_READ_ONLY',
              'soar_actions': False, 'remediation_actions': False,
              'passed': False}
    started = time.monotonic()
    try:
        db = connection()
        result['postgres_connected'] = check_db(db)
        status, health, latency = request_json('GET', api + '/health')
        result['payment_api_http_status'] = status
        result['health_latency_ms'] = latency
        # Le /health n'est qu'une condition prealable, pas la preuve metier.
        if not result['postgres_connected'] or status != 200:
            raise RuntimeError('Preflight technique echoue')
        if not args.execute:
            result['passed'] = True
            return 0

        token = bearer_token(args.login_url)
        status, identity, _ = request_json('GET', api + '/me', token=token)
        result['merchant_access_http_status'] = status
        if status != 200:
            raise RuntimeError('JWT non autorise sur /me')

        key = 'novapay-probe-' + uuid.uuid4().hex
        payload = {'amount_cents': args.amount_cents}
        status, payment, latency = request_json('POST', api + '/transactions',
                                               payload, token=token,
                                               headers={'Idempotency-Key': key})
        if not isinstance(payment, dict):
            raise RuntimeError('Reponse de paiement invalide')
        transaction_id, merchant_id = payment.get('id'), payment.get('merchant_id')
        result.update({'payment_http_status': status, 'payment_latency_ms': latency,
                       'transaction_id': transaction_id, 'merchant_id': merchant_id,
                       'payment_status': payment.get('status'), 'amount_cents': args.amount_cents})
        if status not in (200, 201) or payment.get('status') != 'validated':
            raise RuntimeError('Paiement non valide')
        if transaction_id is None or merchant_id is None:
            raise RuntimeError('Transaction ou marchand absent de la reponse')

        api_row = find_in_api(api, token, transaction_id)
        result['api_readback_verified'] = bool(
            api_row and api_row.get('status') == 'validated'
            and api_row.get('amount_cents') == args.amount_cents)
        result['postgres_readback'] = check_db(db, transaction_id, merchant_id,
                                                key, args.amount_cents)
        if args.verify_replay:
            balance_before_replay = read_balance(db, merchant_id)
            _, replay, _ = request_json('POST', api + '/transactions', payload,
                                        token=token, headers={'Idempotency-Key': key})
            result['idempotent_replay_verified'] = (
                isinstance(replay, dict)
                and str(replay.get('id')) == str(transaction_id)
                and replay.get('idempotent_replay') is True)
            result['balance_unchanged_after_replay'] = (
                read_balance(db, merchant_id) == balance_before_replay)
        if not result['api_readback_verified'] or not result['postgres_readback']['verified']:
            raise RuntimeError('Relecture API ou PostgreSQL incoherente')
        if args.verify_replay and not (result['idempotent_replay_verified']
                                       and result['balance_unchanged_after_replay']):
            raise RuntimeError('Rejeu idempotent non confirme')
        result['passed'] = True
        return 0
    except Exception as exc:
        result['error_type'] = type(exc).__name__
        result['error'] = str(exc)[:250]
        return 1
    finally:
        result['finished_utc'] = timestamp()
        result['elapsed_ms'] = round((time.monotonic() - started) * 1000, 2)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True), flush=True)


if __name__ == '__main__':
    sys.exit(main())
