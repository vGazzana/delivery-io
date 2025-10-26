import fp from "fastify-plugin";

export default fp(async (app) => {
	app.decorateReply("success", function (data, statusCode = 200) {
		this.code(statusCode).send({
			requestId: this.requestId,
			success: true,
			data,
			meta: {
				timestamp: new Date().toISOString(),
				environment: process.env.NODE_ENV || "development",
				tenantId: this.request.tenantId || null,
			},
		});
	});

	app.decorateReply("fail", function (message, statusCode = 400) {
		this.code(statusCode).send({
			requestId: this.requestId,
			success: false,
			message,
		});
	});
});
