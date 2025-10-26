import type { FastifyInstance } from "fastify";
import { server } from "./src";
import { Gateway } from "./src/gateway";
import type { GatewayConfig } from "./src/gateway/interfaces/gateway-interface";

async function main(app: FastifyInstance) {
	app.log.info("Starting Server Application");
	const gateway = new Gateway(app);
	const config: GatewayConfig = {
		port: process.env.PORT ? Number(process.env.PORT) : 3333,
		host: process.env.HOST || "0.0.0.0",
	};
	await gateway.bootstrap(config);
}

main(server);
