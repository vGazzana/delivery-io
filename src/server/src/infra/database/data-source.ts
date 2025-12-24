import { DataSource } from "typeorm";

export const ServerDataSource = new DataSource({
	type: "postgres",
	host: process.env.DATABASE_HOST || "localhost",
	port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 5432,
	username: process.env.DATABASE_USER || "delivery_io_user",
	password: process.env.DATABASE_PASSWORD || "delivery_io_password",
	database: process.env.DATABASE_NAME || "delivery_io_database",
	synchronize: false,
	logging: false,
	entities: ["src/modules/**/entities/*-entity.ts"],
	migrations: ["src/infra/database/migrations/**/*.ts"],
	subscribers: [],
});
