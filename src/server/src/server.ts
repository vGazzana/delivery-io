import Fastify from "fastify";
export const server = Fastify({
	logger: {
		transport: {
			target: process.env.STAGE === "local" ? "pino-pretty" : "pino-logfmt",
			options: { colorize: true, translateTime: "HH:MM:ss Z" },
		},
		level: process.env.STAGE === "local" ? "DEBUG" : "INFO",
	},
	disableRequestLogging: true,
});
