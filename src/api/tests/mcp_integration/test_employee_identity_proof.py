"""Identity proof authenticates the credential owner, never an inferred account."""

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.asymmetric.rsa import generate_private_key
from fastmcp.exceptions import AuthorizationError
from jwt.algorithms import RSAAlgorithm
from langboard.mcp_tools import EmployeeIdentityMcp as proof
from langboard.middlewares.McpAuthMiddleware import mcp_auth_context
from langboard_shared.core.security import OidcClient
from langboard_shared.Env import Env


ISSUER = "https://keycloak.example/realms/yamon"


def configure(monkeypatch):
    monkeypatch.setattr(type(Env), "OIDC_ISSUER", property(lambda _: ISSUER))
    monkeypatch.setattr(type(Env), "OIDC_API_AUDIENCE", property(lambda _: "langboard-api"))


@pytest.mark.parametrize(
    "case",
    [
        "valid",
        "api_key",
        "no_claims",
        "wrong_user",
        "wrong_link",
        "inactive",
        "expired",
        "wrong_audience",
        "wrong_issuer",
    ],
)
def test_identity_proof_is_scoped_and_bounded(monkeypatch, case):
    configure(monkeypatch)
    key = Ed25519PrivateKey.generate()
    monkeypatch.setattr(proof, "identity_signer", lambda: (key, "public", "test"))
    user = SimpleNamespace(id=123)
    now = int(datetime.now(timezone.utc).timestamp())
    claims = {"iss": ISSUER, "sub": "keycloak-user", "aud": "langboard-api", "exp": now + 30}
    link = SimpleNamespace(user_id=123, issuer=ISSUER, external_id="keycloak-user")
    active = SimpleNamespace(activated_at=object(), deleted_at=None)
    context = {"user_or_bot": user, "api_key": None, "oidc_claims": claims}
    if case == "api_key":
        context["api_key"] = object()
    if case == "no_claims":
        context["oidc_claims"] = None
    if case == "wrong_user":
        context["user_or_bot"] = SimpleNamespace(id=456)
    if case == "wrong_link":
        link.external_id = "other-user"
    if case == "inactive":
        active.activated_at = None
    if case == "expired":
        claims["exp"] = now - 1
    if case == "wrong_audience":
        claims["aud"] = "other-api"
    if case == "wrong_issuer":
        claims["iss"] = "https://evil.example"
    service = SimpleNamespace(
        user=SimpleNamespace(get_by_id_like=lambda _: active),
        identity_link=SimpleNamespace(get_by_user_provider=lambda *_: link),
    )
    nonce = str(uuid4())
    token = mcp_auth_context.set(context)
    try:
        if case != "valid":
            with pytest.raises(AuthorizationError):
                proof.get_employee_identity_proof(user, service, nonce)
            return
        result = proof.get_employee_identity_proof(user, service, nonce)
        decoded = jwt.decode(
            result.attestation,
            key.public_key(),
            algorithms=["EdDSA"],
            issuer=proof.PROOF_ISSUER,
            audience=proof.PROOF_AUDIENCE,
        )
        assert decoded["oidc_sub"] == "keycloak-user"
        assert decoded["sub"] == "123"
        assert decoded["request_nonce"] == nonce
        assert decoded["exp"] == claims["exp"]
        assert "email" not in decoded
    finally:
        mcp_auth_context.reset(token)


@pytest.mark.parametrize(
    "overrides", [{}, {"aud": "other-api"}, {"iss": "https://evil.example"}, {"exp": 1}, {"typ": "ID"}]
)
def test_native_oidc_access_validation_rejects_wrong_credential(monkeypatch, overrides):
    configure(monkeypatch)
    key = generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(OidcClient, "is_enabled", lambda: True)
    monkeypatch.setattr(OidcClient, "get_discovery", lambda: {"issuer": ISSUER})
    import json

    monkeypatch.setattr(OidcClient, "_find_jwk", lambda _: json.loads(RSAAlgorithm.to_jwk(key.public_key())))
    now = int(datetime.now(timezone.utc).timestamp())
    claims = {
        "iss": ISSUER,
        "sub": "keycloak-user",
        "aud": "langboard-api",
        "exp": now + 60,
        "iat": now,
        "typ": "Bearer",
        **overrides,
    }
    token = jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test"})
    if overrides:
        with pytest.raises(Exception):
            OidcClient.validate_access_token(token)
    else:
        assert OidcClient.validate_access_token(token)["sub"] == "keycloak-user"
        forged = jwt.encode(claims, generate_private_key(public_exponent=65537, key_size=2048), algorithm="RS256")
        with pytest.raises(jwt.InvalidSignatureError):
            OidcClient.validate_access_token(forged)


@pytest.mark.parametrize("case", ["valid", "issuer", "inactive", "same_account"])
def test_oidc_resolution_requires_existing_exact_account_link(monkeypatch, case):
    from langboard_shared.security import OidcMcpIdentity as identity

    claims = {"iss": ISSUER, "sub": "keycloak-user"}
    monkeypatch.setattr(OidcClient, "validate_access_token", lambda _: claims)
    user = SimpleNamespace(id=123, activated_at=object(), deleted_at=None)
    link = SimpleNamespace(user_id=123, issuer=ISSUER, external_id="keycloak-user")
    current = SimpleNamespace(issuer=ISSUER, external_id="keycloak-user")
    if case == "issuer":
        link.issuer = "https://evil.example"
    if case == "inactive":
        user.deleted_at = object()
    if case == "same_account":
        current.external_id = "another-person"
    service = SimpleNamespace(
        identity_link=SimpleNamespace(
            get_by_provider_external_id=lambda *_: link, get_by_user_provider=lambda *_: current
        ),
        user=SimpleNamespace(get_by_id_like=lambda _: user),
        close=lambda: None,
    )
    monkeypatch.setattr(identity, "DomainService", lambda: service)
    if case == "valid":
        assert identity.resolve_oidc_mcp_identity("opaque")[0] is user
    else:
        with pytest.raises(PermissionError):
            identity.resolve_oidc_mcp_identity("opaque")
