import type { FastifyInstance } from "fastify";

export interface RouterFunction {
	app: FastifyInstance;
}
