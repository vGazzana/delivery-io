import fp from "fastify-plugin";

export default fp(async (app) => {
	app.addHook("onRequest", (req, _reply, done) => {
		app.log.info(
			{
				method: req.method,
				url: req.url,
				input: req.body,
				headers: req.headers,
			},
			"[GATEWAY] Incoming request",
		);
		done();
	});
});
