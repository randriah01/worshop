"""NovaPay Face Login (pilote) : biométrie ET preuve WebAuthn obligatoires.

La biométrie ne déclenche jamais seule la délivrance d'un JWT.
La vérification WebAuthn exige user_verification mais ne garantit pas un VISAGE :
le système d'exploitation peut utiliser PIN / empreinte / Face ID.
"""
import datetime
import json
import math
import os
import secrets
import uuid
from typing import Any

import httpx
import jwt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
)

from .main import SECRET, db, make_token, face_required, verify_password

router = APIRouter(prefix="/face", tags=["Face Login - pilote"])
FACE_AI_URL = os.getenv("FACE_AI_URL", "http://face-ai:8080")
SCORE_DISTANCE_MAX = 0.30  # SEUIL POC non calibré : exige un jeu de validation avant production


class Frames(BaseModel):
    images: list[str] = Field(min_length=3, max_length=3)


class EnrollBody(Frames):
    consent: bool = False
    password: str | None = None


class PasswordConfirm(BaseModel):
    password: str = Field(min_length=1)


class PasskeyRegistrationRequest(BaseModel):
    password: str | None = None


class LoginStart(BaseModel):
    login: str = Field(min_length=3, max_length=40)


class LoginVerify(Frames):
    challenge_id: uuid.UUID


class ChallengeBody(BaseModel):
    challenge_id: uuid.UUID


class WebauthnAnswer(ChallengeBody):
    credential: dict[str, Any]


def config():
    rp_id = os.getenv("WEBAUTHN_RP_ID", "").strip()
    origin = os.getenv("WEBAUTHN_ORIGIN", "").strip()
    key = os.getenv("FACE_ENCRYPTION_KEY", "")
    internal_token = os.getenv("FACE_INTERNAL_TOKEN", "")
    if not rp_id or not origin or not key or not internal_token:
        raise HTTPException(503, "Connexion faciale non configurée sur le serveur")
    try:
        cipher = Fernet(key.encode("ascii"))
    except (ValueError, TypeError):
        raise HTTPException(503, "Clé de chiffrement facial mal configurée")
    # Une origine HTTPS ne doit pas être remplacée par l'URL du proxy interne.
    if not origin.startswith("https://") and not origin.startswith("http://localhost"):
        raise HTTPException(503, "WEBAUTHN_ORIGIN doit être une origine HTTPS publique")
    return rp_id, origin, cipher, internal_token


def current_user(authorization: str | None, *, allow_setup: bool = True):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Connexion requise")
    try:
        payload = jwt.decode(authorization.split(" ", 1)[1], SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session invalide")
    if face_required():
        level = payload.get("auth_level")
        if level != "full" and not (allow_setup and level == "setup"):
            raise HTTPException(403, "Session non autorisée pour cette opération")
        if level == "full" and not {"pwd", "face", "webauthn"}.issubset(set(payload.get("amr", []))):
            raise HTTPException(403, "Vérification multifactorielle requise")
    conn = db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, login, merchant_id, role FROM merchant_users WHERE login=%s AND merchant_id=%s",
                (payload.get("sub"), payload.get("merchant_id")),
            )
            row = cur.fetchone()
        if not row:
            raise HTTPException(401, "Session invalide")
        return row
    finally:
        conn.close()


def check_challenge(cur, challenge_id: uuid.UUID, purpose: str, user_id=None, lock=False):
    query = ("SELECT id, user_id, challenge, face_verified FROM biometric_challenges "
             "WHERE id=%s AND purpose=%s AND expires_at > now()")
    if user_id is not None:
        query += " AND user_id=%s"
        args = (str(challenge_id), purpose, user_id)
    else:
        args = (str(challenge_id), purpose)
    if lock:
        query += " FOR UPDATE"
    cur.execute(query, args)
    row = cur.fetchone()
    if not row:
        raise HTTPException(401, "Défi expiré ou invalide")
    return row


def analyze(images: list[str], internal_token: str):
    # Les images ne sont jamais écrites dans des fichiers ou dans la base.
    try:
        response = httpx.post(
            f"{FACE_AI_URL}/embeddings",
            json={"images": images},
            headers={"X-Internal-Token": internal_token},
            timeout=90.0,
        )
        if response.status_code == 422:
            raise HTTPException(422, "Visage non reconnu comme vivant / qualité insuffisante")
        response.raise_for_status()
        data = response.json()
        vector = data["embedding"]
        if data["model"] != "Facenet512" or len(vector) != 512:
            raise ValueError("Dimensions invalides")
        if not all(isinstance(n, (int, float)) and math.isfinite(n) for n in vector):
            raise ValueError("Valeurs invalides")
        return vector
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "Service de reconnaissance faciale indisponible")


def cosine_distance(a, b):
    if len(a) != len(b):
        return 1.0
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a <= 0 or norm_b <= 0:
        return 1.0
    return 1.0 - (sum(x * y for x, y in zip(a, b)) / (norm_a * norm_b))


@router.post("/passkey/register/options")
def passkey_register_options(body: PasskeyRegistrationRequest, authorization: str | None = Header(default=None)):
    rp_id, _, _, _ = config()
    user_id, login, _, _ = current_user(authorization)
    conn = db()
    try:
        with conn.cursor() as cur:
            # Ajout d'une passkey à un compte déjà configuré = opération sensible.
            cur.execute("SELECT count(*) FROM passkey_credentials WHERE user_id=%s", (user_id,))
            count = cur.fetchone()[0]
            if count:
                if not body.password:
                    raise HTTPException(403, "Confirme ton mot de passe pour ajouter une autre passkey")
                cur.execute("SELECT password_hash FROM merchant_users WHERE id=%s", (user_id,))
                if not verify_password(body.password, cur.fetchone()[0]):
                    raise HTTPException(403, "Mot de passe incorrect")
            cur.execute("DELETE FROM biometric_challenges WHERE expires_at < now()-interval '1 day'")
            cur.execute("SELECT credential_id FROM passkey_credentials WHERE user_id=%s", (user_id,))
            credentials = [PublicKeyCredentialDescriptor(id=bytes(r[0])) for r in cur.fetchall()]
            opts = generate_registration_options(
                rp_id=rp_id, rp_name="NovaPay", user_name=login,
                user_id=user_id.to_bytes(16, "big"),
                authenticator_selection=AuthenticatorSelectionCriteria(
                    user_verification=UserVerificationRequirement.REQUIRED,
                ),
                exclude_credentials=credentials,
            )
            challenge_id = uuid.uuid4()
            cur.execute(
                "INSERT INTO biometric_challenges (id,user_id,purpose,challenge,expires_at) "
                "VALUES (%s,%s,'passkey_register',%s,now()+interval '5 minutes')",
                (str(challenge_id), user_id, opts.challenge),
            )
        conn.commit()
        return {"challenge_id": str(challenge_id), "options": json.loads(options_to_json(opts))}
    finally:
        conn.close()


@router.post("/passkey/register/verify")
def passkey_register_verify(body: WebauthnAnswer, authorization: str | None = Header(default=None)):
    rp_id, origin, _, _ = config()
    user_id, _, _, _ = current_user(authorization)
    conn = db()
    try:
        with conn.cursor() as cur:
            challenge = check_challenge(cur, body.challenge_id, "passkey_register", user_id, lock=True)
            try:
                verified = verify_registration_response(
                    credential=body.credential,
                    expected_challenge=bytes(challenge[2]),
                    expected_rp_id=rp_id,
                    expected_origin=origin,
                    require_user_verification=True,
                )
            except Exception:
                raise HTTPException(401, "Vérification de la passkey refusée")
            cur.execute(
                "INSERT INTO passkey_credentials(user_id,credential_id,public_key,sign_count) "
                "VALUES (%s,%s,%s,%s) ON CONFLICT (credential_id) DO NOTHING RETURNING id",
                (user_id, verified.credential_id, verified.credential_public_key, verified.sign_count),
            )
            if not cur.fetchone():
                raise HTTPException(409, "Cette passkey est déjà associée à un compte")
            cur.execute("DELETE FROM biometric_challenges WHERE id=%s", (str(body.challenge_id),))
        conn.commit()
        return {"registered": True}
    finally:
        conn.close()


@router.post("/enroll")
def enroll(body: EnrollBody, authorization: str | None = Header(default=None)):
    _, _, cipher, token = config()
    user_id, _, _, _ = current_user(authorization)
    if not body.consent:
        raise HTTPException(400, "Consentement explicite requis pour la biométrie")
    conn = db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM passkey_credentials WHERE user_id=%s", (user_id,))
            if not cur.fetchone():
                raise HTTPException(403, "Ajoute une passkey sécurisée avant d'enregistrer ton visage")
            cur.execute("SELECT 1 FROM face_templates WHERE user_id=%s", (user_id,))
            if cur.fetchone() and face_required():
                cur.execute("SELECT password_hash FROM merchant_users WHERE id=%s", (user_id,))
                if not body.password or not verify_password(body.password, cur.fetchone()[0]):
                    raise HTTPException(403, "Confirme ton mot de passe pour remplacer ton visage enregistré")
        vector = analyze(body.images, token)
        encrypted = cipher.encrypt(json.dumps(vector).encode("utf-8")).decode("ascii")
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO face_templates(user_id,encrypted_embedding,model) VALUES (%s,%s,'Facenet512') "
                "ON CONFLICT(user_id) DO UPDATE SET encrypted_embedding=excluded.encrypted_embedding, "
                "model=excluded.model, consented_at=now(), created_at=now()",
                (user_id, encrypted),
            )
        conn.commit()
        return {"enrolled": True, "status": "pilote_non_certifie"}
    finally:
        conn.close()


@router.get("/status")
def status(authorization: str | None = Header(default=None)):
    config()
    user_id, _, _, _ = current_user(authorization)
    conn = db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT EXISTS(SELECT 1 FROM passkey_credentials WHERE user_id=%s), "
                        "EXISTS(SELECT 1 FROM face_templates WHERE user_id=%s)", (user_id, user_id))
            row = cur.fetchone()
        return {"passkey_registered": row[0], "face_enrolled": row[1]}
    finally:
        conn.close()


@router.delete("/enrollment")
def delete_enrollment(body: PasswordConfirm, authorization: str | None = Header(default=None)):
    config()
    user_id, _, _, _ = current_user(authorization, allow_setup=False)
    conn = db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM merchant_users WHERE id=%s", (user_id,))
            if not verify_password(body.password, cur.fetchone()[0]):
                raise HTTPException(403, "Mot de passe incorrect")
            cur.execute("DELETE FROM biometric_challenges WHERE user_id=%s", (user_id,))
            cur.execute("DELETE FROM face_templates WHERE user_id=%s", (user_id,))
            cur.execute("DELETE FROM passkey_credentials WHERE user_id=%s", (user_id,))
        conn.commit()
        return {"deleted": True}
    finally:
        conn.close()


@router.get("/passkeys")
def list_passkeys(authorization: str | None = Header(default=None)):
    config()
    user_id, _, _, _ = current_user(authorization)
    conn = db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, created_at FROM passkey_credentials WHERE user_id=%s ORDER BY created_at", (user_id,))
            rows = cur.fetchall()
        return {"passkeys": [{"id": r[0], "created_at": r[1].isoformat()} for r in rows]}
    finally:
        conn.close()


@router.delete("/passkeys/{passkey_id}")
def delete_passkey(passkey_id: int, body: PasswordConfirm, authorization: str | None = Header(default=None)):
    config()
    user_id, _, _, _ = current_user(authorization, allow_setup=False)
    conn = db()
    try:
        with conn.cursor() as cur:
            # Verrouille le compte : évite deux suppressions concurrentes de la dernière clé.
            cur.execute("SELECT password_hash FROM merchant_users WHERE id=%s FOR UPDATE", (user_id,))
            if not verify_password(body.password, cur.fetchone()[0]):
                raise HTTPException(403, "Mot de passe incorrect")
            cur.execute("SELECT count(*) FROM passkey_credentials WHERE user_id=%s", (user_id,))
            if cur.fetchone()[0] <= 1:
                raise HTTPException(409, "Ajoute une autre passkey avant de supprimer la dernière")
            cur.execute("DELETE FROM passkey_credentials WHERE id=%s AND user_id=%s RETURNING id", (passkey_id, user_id))
            if not cur.fetchone():
                raise HTTPException(404, "Passkey introuvable")
        conn.commit()
        return {"deleted": True}
    finally:
        conn.close()


@router.post("/login/challenge")
def login_challenge(body: LoginStart):
    # Ancienne connexion sans mot de passe : interdite en mode facial obligatoire.
    if face_required():
        raise HTTPException(403, "Utilise /auth/login avec identifiant et mot de passe")
    config()
    login = body.login.strip().lower()
    conn = db()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM biometric_challenges WHERE expires_at < now()-interval '1 day'")
            cur.execute(
                "SELECT u.id FROM merchant_users u "
                "JOIN face_templates f ON f.user_id=u.id "
                "WHERE u.login=%s AND EXISTS (SELECT 1 FROM passkey_credentials p WHERE p.user_id=u.id)",
                (login,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(401, "Connexion faciale non disponible pour ce compte")
            user_id = row[0]
            cur.execute(
                "SELECT count(*) FROM biometric_challenges "
                "WHERE user_id=%s AND purpose='face_login' AND created_at>now()-interval '15 minutes'",
                (user_id,),
            )
            if cur.fetchone()[0] >= 8:
                raise HTTPException(429, "Trop de tentatives : réessaie plus tard")
            challenge_id = uuid.uuid4()
            cur.execute(
                "INSERT INTO biometric_challenges(id,user_id,purpose,expires_at) "
                "VALUES (%s,%s,'face_login',now()+interval '3 minutes')",
                (str(challenge_id), user_id),
            )
        conn.commit()
        return {"challenge_id": str(challenge_id), "expires_in_seconds": 180}
    finally:
        conn.close()


@router.post("/login/verify")
def login_verify(body: LoginVerify):
    _, _, cipher, token = config()
    conn = db()
    try:
        with conn.cursor() as cur:
            chall = check_challenge(cur, body.challenge_id, "face_login")
            if chall[3]:
                raise HTTPException(401, "Défi déjà utilisé")
            cur.execute("SELECT encrypted_embedding FROM face_templates WHERE user_id=%s", (chall[1],))
            row = cur.fetchone()
            if not row:
                raise HTTPException(401, "Vérification refusée")
            encrypted_reference = row[0]
        vector = analyze(body.images, token)
        try:
            reference = json.loads(cipher.decrypt(encrypted_reference.encode("ascii")))
        except (InvalidToken, ValueError, TypeError):
            raise HTTPException(503, "Référence biométrique illisible")
        if cosine_distance(vector, reference) > SCORE_DISTANCE_MAX:
            raise HTTPException(401, "Visage non reconnu")
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE biometric_challenges SET face_verified=true "
                "WHERE id=%s AND face_verified=false AND expires_at>now() RETURNING id",
                (str(body.challenge_id),),
            )
            if not cur.fetchone():
                raise HTTPException(401, "Défi expiré ou déjà utilisé")
        conn.commit()
        return {"face_verified": True, "next_step": "passkey"}
    finally:
        conn.close()


@router.post("/login/passkey/options")
def login_passkey_options(body: ChallengeBody):
    _, _, _, _ = config()
    conn = db()
    try:
        with conn.cursor() as cur:
            chall = check_challenge(cur, body.challenge_id, "face_login", lock=True)
            if not chall[3]:
                raise HTTPException(401, "Reconnaissance faciale requise")
            cur.execute("SELECT credential_id FROM passkey_credentials WHERE user_id=%s", (chall[1],))
            allow = [PublicKeyCredentialDescriptor(id=bytes(r[0])) for r in cur.fetchall()]
            if not allow:
                raise HTTPException(401, "Passkey non disponible")
            opts = generate_authentication_options(
                rp_id=os.getenv("WEBAUTHN_RP_ID"),
                allow_credentials=allow,
                user_verification=UserVerificationRequirement.REQUIRED,
            )
            cur.execute("UPDATE biometric_challenges SET challenge=%s WHERE id=%s", (opts.challenge, str(body.challenge_id)))
        conn.commit()
        return {"options": json.loads(options_to_json(opts))}
    finally:
        conn.close()


@router.post("/login/passkey/verify")
def login_passkey_verify(body: WebauthnAnswer):
    rp_id, origin, _, _ = config()
    conn = db()
    try:
        with conn.cursor() as cur:
            chall = check_challenge(cur, body.challenge_id, "face_login", lock=True)
            if not chall[3] or not chall[2]:
                raise HTTPException(401, "Étapes préalables incomplètes")
            try:
                credential_id = base64url_to_bytes(body.credential["id"])
            except (KeyError, ValueError, TypeError):
                raise HTTPException(401, "Passkey invalide")
            cur.execute(
                "SELECT id,public_key,sign_count FROM passkey_credentials "
                "WHERE credential_id=%s AND user_id=%s FOR UPDATE",
                (credential_id, chall[1]),
            )
            key = cur.fetchone()
            if not key:
                raise HTTPException(401, "Passkey non autorisée")
            try:
                verified = verify_authentication_response(
                    credential=body.credential,
                    expected_challenge=bytes(chall[2]),
                    expected_rp_id=rp_id,
                    expected_origin=origin,
                    credential_public_key=bytes(key[1]),
                    credential_current_sign_count=key[2],
                    require_user_verification=True,
                )
            except Exception:
                raise HTTPException(401, "Signature cryptographique refusée")
            cur.execute(
                "UPDATE passkey_credentials SET sign_count=%s WHERE id=%s",
                (verified.new_sign_count, key[0]),
            )
            cur.execute("DELETE FROM biometric_challenges WHERE id=%s", (str(body.challenge_id),))
            cur.execute("SELECT login,merchant_id,role FROM merchant_users WHERE id=%s", (chall[1],))
            account = cur.fetchone()
            if not account:
                raise HTTPException(401, "Compte introuvable")
        conn.commit()
        return {"access_token": make_token(*account, level="full", methods=["pwd", "face", "webauthn"]),
                "token_type": "bearer"}
    finally:
        conn.close()
