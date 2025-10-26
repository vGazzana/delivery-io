import crypto from "node:crypto";
import fp from "fastify-plugin";

export default fp(async (app) => {
	app.addHook("onRequest", async (request, reply) => {
		const requestId = crypto
			.createHash("sha1")
			.update(`${Date.now()}-${Math.random()}`)
			.digest("hex")
			.substring(0, 32);

		request.requestId = requestId;
		reply.requestId = requestId;

		request.log = app.log.child({ requestId });
		app.log = app.log.child({ requestId });
		request.headers["x-request-id"] = requestId;
		reply.header("x-request-id", requestId);
	});
});
