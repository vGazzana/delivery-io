import type { FastifyInstance } from "fastify";
import { AUTH_ROUTES } from "../modules/auth/routes";
import type { GatewayConfig, IGateway } from "./interfaces/gateway-interface";
import {
	requestIdPlugin,
	requestLoggerPlugin,
	responsePlugin,
} from "./plugins";

export class Gateway implements IGateway {
	constructor(private app: FastifyInstance) {}

	public async bootstrap(config: GatewayConfig): Promise<void> {
		try {
			await this.bootstrapPlugins();
			await this.bootstrapRoutes();
			await this.app.listen(config);
			this.app.log.info(
				`Gateway listening on http://${config.host}:${config.port}`,
			);
		} catch (error) {
			if (error instanceof Error) {
				this.app.log.error(`Gateway bootstrap error: ${error}`);
			}
		}
	}

	private async bootstrapPlugins(): Promise<void> {
		try {
			this.app.log.info("Registering Gateway plugins");
			await this.app.register(import("@fastify/cookie"));
			await this.app.register(requestIdPlugin);
			await this.app.register(responsePlugin);
			await this.app.register(requestLoggerPlugin);
			this.app.log.info("Gateway plugins registered successfully");
		} catch (error) {
			if (error instanceof Error) {
				this.app.log.error(`Gateway plugin registration error: ${error}`);
			}
		}
	}

	private async bootstrapRoutes(): Promise<void> {
		try {
			await this.app.register(AUTH_ROUTES);
		} catch (error) {
			if (error instanceof Error) {
				this.app.log.error(`Gateway route registration error: ${error}`);
			}
		}
	}
}
