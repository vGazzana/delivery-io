import type { FastifyInstance } from "fastify";
import { server } from "./src";
import { Gateway } from "./src/gateway";
import type { GatewayConfig } from "./src/gateway/interfaces/gateway-interface";
import "reflect-metadata";
import { ServerDataSource } from "./src/infra/database";

async function main(app: FastifyInstance) {
	try {
		app.log.info("Starting Server Application");
		await ServerDataSource.initialize();

		const gateway = new Gateway(app);
		const config: GatewayConfig = {
			port: process.env.PORT ? Number(process.env.PORT) : 3333,
			host: process.env.HOST || "0.0.0.0",
		};
		await gateway.bootstrap(config);
	} catch (error) {
		console.error("Error during server initialization:", error);
		process.exit(1);
	}
}

main(server);
