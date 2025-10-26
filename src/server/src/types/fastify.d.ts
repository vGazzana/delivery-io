import "fastify";
import type { JWTPayload } from "@delivery/shared";

declare module "fastify" {
	interface FastifyRequest {
		requestId: string;
		tenantId?: string;
		user?: JWTPayload;
		cookies: { [cookieName: string]: string | undefined };
	}

	interface FastifyInstance {
		authenticate: (
			request: FastifyRequest,
			reply: FastifyReply,
		) => Promise<void>;
		clearAuthCookies: (reply: FastifyReply) => void;
	}

	interface FastifyReply {
		requestId: string;
		success: <T>(data: T, statusCode?: number) => void;
		fail: (message: string, statusCode?: number) => void;
		setCookie: (name: string, value: string, options?: any) => this;
		clearCookie: (name: string, options?: any) => this;
	}
}
