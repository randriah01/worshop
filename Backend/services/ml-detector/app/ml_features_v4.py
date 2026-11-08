"""NovaPay V4 experimental features: read-only Prometheus snapshots from Payment API.

Covers Payment API, not Nginx/WAF or auth-service; source attribution is impossible here.
"""
import math
import re
from dataclasses import dataclass

FEATURES = ('api_rate','http_5xx_ratio','api_latency_mean_ms','payment_rate','payment_error_ratio','db_up')
METRIC = re.compile(r'^([a-zA-Z_:][\w:]*)(?:\{([^}]*)\})?\s+([^\s]+)')
LABEL = re.compile(r'([A-Za-z_][\w]*)="((?:[^"\\]|\\.)*)"')
BUSINESS_ENDPOINTS = frozenset(('/transactions','/me','/stats'))

@dataclass(frozen=True)
class Snapshot:
    requests: float = 0.0
    errors: float = 0.0
    duration_sum: float = 0.0
    duration_count: float = 0.0
    payments: float = 0.0
    payment_errors: float = 0.0
    db_up: float = 0.0


def parse_metrics(body: str) -> Snapshot:
    accum = dict(requests=0., errors=0., duration_sum=0., duration_count=0., payments=0., payment_errors=0.)
    database = None
    saw_business_req = False
    for raw in body.splitlines():
        m = METRIC.match(raw.strip())
        if not m: continue
        name, rawlabels, raw_value = m.groups()
        try: v = float(raw_value)
        except ValueError: continue
        if not math.isfinite(v) or v < 0: raise ValueError('Métrique non finie/négative: '+name)
        labels = dict(LABEL.findall(rawlabels or ''))
        endpoint = labels.get('endpoint')
        if name == 'novapay_db_up': database = v
        elif name == 'novapay_http_requests_total' and endpoint in BUSINESS_ENDPOINTS:
            saw_business_req = True
            accum['requests'] += v
            if labels.get('status','').startswith('5'): accum['errors'] += v
        elif name == 'novapay_http_request_duration_seconds_sum' and endpoint in BUSINESS_ENDPOINTS:
            accum['duration_sum'] += v
        elif name == 'novapay_http_request_duration_seconds_count' and endpoint in BUSINESS_ENDPOINTS:
            accum['duration_count'] += v
        elif name == 'novapay_transactions_total':
            accum['payments'] += v
            if labels.get('status') == 'error': accum['payment_errors'] += v
    if database is None: raise ValueError('novapay_db_up introuvable')
    if not saw_business_req: raise ValueError('Pas de compteur API métier (/transactions,/me,/stats); générer un paiement témoin')
    if database not in (0, 1): raise ValueError('novapay_db_up différent de 0/1')
    return Snapshot(**accum, db_up=database)


def window(previous: Snapshot, current: Snapshot, elapsed: float) -> dict:
    if not math.isfinite(elapsed) or elapsed <= 0: raise ValueError('Intervalle invalide')
    fields = ('requests','errors','duration_sum','duration_count','payments','payment_errors')
    delta = {name: getattr(current,name)-getattr(previous,name) for name in fields}
    if any(v < -1e-8 for v in delta.values()):
        raise ValueError('Réinitialisation des compteurs; fenêtre rejetée')
    n,err = delta['requests'],delta['errors']
    p,pe = delta['payments'],delta['payment_errors']
    if err > n + 1e-8 or pe > p + 1e-8: raise ValueError('Compteurs incohérents')
    c = delta['duration_count']
    return {
        'api_rate': round(n/elapsed,6),
        'http_5xx_ratio': round(err/n,6) if n else 0.,
        'api_latency_mean_ms': round(1000*delta['duration_sum']/c,4) if c else 0.,
        'payment_rate': round(p/elapsed,6),
        'payment_error_ratio': round(pe/p,6) if p else 0.,
        'db_up': float(current.db_up),
    }
