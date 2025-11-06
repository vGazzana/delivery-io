import type { JWTPayload } from "@delivery/shared";
import { JWTService } from "@delivery/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

export class AuthService {
	private jwtService: JWTService;

	constructor() {
		this.jwtService = new JWTService(
			String(process.env.JWT_ACCESS_SECRET),
			String(process.env.JWT_REFRESH_SECRET),
		);
	}

	async login(email: string, password: string) {
		const payload: Omit<JWTPayload, "iat" | "exp"> = {
			userId: 1,
			email,
			tenantId: "tenant-uuid",
			role: "admin",
		};

		return this.jwtService.generateTokens(payload);
	}

	async refreshToken(refreshToken: string) {
		try {
			const payload = this.jwtService.verifyRefreshToken(refreshToken);

			const newPayload: Omit<JWTPayload, "iat" | "exp"> = {
				userId: payload.userId,
				email: payload.email,
				tenantId: payload.tenantId,
				role: payload.role,
			};

			return this.jwtService.generateTokens(newPayload);
		} catch (error) {
			throw new Error("Invalid refresh token");
		}
	}

	verifyToken(token: string) {
		return this.jwtService.verifyAccessToken(token);
	}

	verifyRefreshToken(refreshToken: string) {
		return this.jwtService.verifyRefreshToken(refreshToken);
	}

	async logout(refreshToken: string) {
		try {
			this.jwtService.verifyRefreshToken(refreshToken);
			return { success: true, message: "Logout successful" };
		} catch (error) {
			throw new Error("Invalid refresh token");
		}
	}

	/**
	 * PreHandler para autenticação de rotas protegidas
	 */
	authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
		try {
			const token = request.headers.authorization?.replace("Bearer ", "");

			if (!token) {
				return reply.fail("Token required", 401);
			}

			const payload = this.verifyToken(token);
			request.user = payload;
			request.tenantId = payload.tenantId;
		} catch (error) {
			return reply.fail("Invalid token", 401);
		}
	};

	setAuthCookies(
		reply: FastifyReply,
		tokens: { accessToken: string; refreshToken: string },
	) {
		reply.setCookie("accessToken", tokens.accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 15 * 60 * 1000, // 15 minutes
			path: "/",
		});

		reply.setCookie("refreshToken", tokens.refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			path: "/",
		});
	}

	clearAuthCookies(reply: FastifyReply) {
		reply.clearCookie("accessToken", {
			path: "/",
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			expires: new Date(0),
		});
		reply.clearCookie("refreshToken", {
			path: "/",
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			expires: new Date(0),
		});
	}
}
