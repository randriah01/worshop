"""Collects normal baseline or independent normal validation, without writing any API."""
import argparse,csv,json,os,time
from pathlib import Path
import requests
from ml_features_v4 import FEATURES,parse_metrics,window

def capture(api, samples, interval, output):
    if samples < 30 or interval < 1: raise ValueError('samples>=30 et interval>=1 exigés')
    def snap():
        r=requests.get(api.rstrip('/')+'/metrics',timeout=4);r.raise_for_status()
        return parse_metrics(r.text)
    previous=snap(); last=time.monotonic(); rows=[]
    for i in range(samples):
        time.sleep(interval)
        current=snap();now=time.monotonic()
        try: rows.append(window(previous,current,now-last))
        except ValueError as exc: print(json.dumps({'event':'window_skipped','reason':str(exc)},ensure_ascii=False),flush=True)
        previous,last=current,now
        if (i+1)%10==0: print(json.dumps({'event':'capture_progress','windows':i+1,'accepted':len(rows)}),flush=True)
    out=Path(output);out.parent.mkdir(parents=True,exist_ok=True)
    with out.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=FEATURES);w.writeheader();w.writerows(rows)
    print(json.dumps({'event':'capture_complete','accepted':len(rows),'output':str(out)}),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--api',default=os.getenv('PAYMENT_API','http://payment-api:8080'))
    p.add_argument('--samples',type=int,default=150);p.add_argument('--interval',type=float,default=5)
    p.add_argument('--out',default='/tmp/novapay_v4_train.csv');a=p.parse_args()
    capture(a.api,a.samples,a.interval,a.out)
