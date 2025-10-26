import { createSigner, createVerifier } from "fast-jwt";
import type { JWTPayload, TokenPair } from "../types/auth";

export class JWTService {
	private accessTokenSigner;
	private refreshTokenSigner;
	private accessTokenVerifier;
	private refreshTokenVerifier;

	constructor(
		private accessSecret: string,
		private refreshSecret: string,
		private accessExpiresIn = "15m",
		private refreshExpiresIn = "7d",
	) {
		this.accessTokenSigner = createSigner({
			key: this.accessSecret,
			expiresIn: this.accessExpiresIn,
		});
		this.refreshTokenSigner = createSigner({
			key: this.refreshSecret,
			expiresIn: this.refreshExpiresIn,
		});
		this.accessTokenVerifier = createVerifier({ key: this.accessSecret });
		this.refreshTokenVerifier = createVerifier({ key: this.refreshSecret });
	}

	generateTokens(payload: Omit<JWTPayload, "iat" | "exp">): TokenPair {
		return {
			accessToken: this.accessTokenSigner(payload),
			refreshToken: this.refreshTokenSigner({
				userId: payload.userId,
				tenantId: payload.tenantId,
			}),
		};
	}

	verifyAccessToken(token: string): JWTPayload {
		return this.accessTokenVerifier(token) as JWTPayload;
	}

	verifyRefreshToken(token: string) {
		return this.refreshTokenVerifier(token) as Pick<
			JWTPayload,
			"userId" | "tenantId" | "email" | "role"
		>;
	}
}
