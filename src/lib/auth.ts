import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";

let _issuer: string | undefined;
let _jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getAuth() {
	if (!_issuer || !_jwks) {
		_issuer = process.env.AUTH_ISSUER;
		if (!_issuer) throw new Error("Missing required env var: AUTH_ISSUER");
		_jwks = createRemoteJWKSet(new URL(`${_issuer}/protocol/openid-connect/certs`));
	}
	return { issuer: _issuer, jwks: _jwks };
}

interface KeycloakPayload extends JWTPayload {
	resource_access?: {
		"j26-bracelet-checker"?: {
			roles: string[];
		};
	};
	name?: string;
	preferred_username?: string;
	email?: string;
	picture?: string;
}

export interface AppUser {
	sub: string;
	name: string;
	email: string;
	preferredUsername: string;
	picture?: string;
	roles: string[];
}

export async function verifyAndGetUser(token: string): Promise<AppUser | null> {
	try {
		const { jwks, issuer } = getAuth();
		const { payload } = await jwtVerify<KeycloakPayload>(token, jwks, {
			issuer,
		});

		return {
			sub: payload.sub!,
			name: payload.name ?? "Okänd",
			email: payload.email ?? "",
			preferredUsername: payload.preferred_username ?? "",
			picture: payload.picture,
			roles: payload.resource_access?.["j26-bracelet-checker"]?.roles ?? [],
		};
	} catch (err) {
		console.error("[auth] verifyAndGetUser failed:", err);
		return null;
	}
}
