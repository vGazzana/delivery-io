import type { FastifyPluginAsync } from "fastify";
import { AuthService } from "../services/auth-service";

interface LoginBody {
	email: string;
	password: string;
}

interface RegisterBody {
	email: string;
	password: string;
	name: string;
}

interface RefreshBody {
	refreshToken: string;
}

export const AUTH_ROUTES: FastifyPluginAsync = async (app) => {
	const authService = new AuthService();
	const authHandler = { preHandler: authService.authenticate };

	app.post<{ Body: LoginBody }>("/login", async (req, reply) => {
		try {
			const { email, password } = req.body;

			if (!email || !password) {
				return reply.fail("Email and password are required", 400);
			}

			const tokens = await authService.login(email, password);

			authService.setAuthCookies(reply, tokens);

			return reply.success({
				user: {
					userId: 1,
					email,
					tenantId: "tenant-uuid",
					role: "admin",
				},
				tokens,
			});
		} catch (error) {
			app.log.error(`Login error: ${error}`);
			return reply.fail("Invalid credentials", 401);
		}
	});

	app.post<{ Body: RegisterBody }>("/register", async (req, reply) => {
		try {
			const { email, password, name } = req.body;

			if (!email || !password || !name) {
				return reply.fail("Email, password and name are required", 400);
			}
			return reply.success({ userId: "new-user-id" });
		} catch (error) {
			return reply.fail("Registration failed", 500);
		}
	});

	app.get("/me", { ...authHandler }, async (req, reply) => {
		const user = req.user;
		return reply.success({
			user,
		});
	});

	app.post<{ Body: RefreshBody }>("/refresh", async (req, reply) => {
		try {
			const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

			if (!refreshToken) {
				return reply.fail("Refresh token is required", 400);
			}

			const tokens = await authService.refreshToken(refreshToken);

			authService.setAuthCookies(reply, tokens);

			return reply.success({ tokens });
		} catch (error) {
			authService.clearAuthCookies(reply);
			return reply.fail("Invalid refresh token", 401);
		}
	});

	app.post<{ Body: RefreshBody }>("/logout", async (req, reply) => {
		try {
			const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

			if (refreshToken) {
				await authService.logout(refreshToken);
			}

			authService.clearAuthCookies(reply);

			return reply.success({ message: "Logout successful" });
		} catch (error) {
			authService.clearAuthCookies(reply);
			return reply.success({ message: "Logout completed" });
		}
	});

	app.get("/status", async (req, reply) => {
		const user = req.user;
		return reply.success({
			authenticated: true,
			user: {
				userId: user?.userId,
				email: user?.email,
				tenantId: user?.tenantId,
				role: user?.role,
			},
		});
	});
};
