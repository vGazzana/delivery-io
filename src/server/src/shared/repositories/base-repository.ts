import type { ObjectLiteral, Repository } from "typeorm";
import { ServerDataSource } from "../../infra/database";

export class BaseRepository {
	protected getRepository<T extends ObjectLiteral>(
		repositoryName: string,
	): Repository<T> {
		try {
			return ServerDataSource.getRepository<T>(repositoryName);
		} catch (error) {
			console.error(`Error getting repository ${repositoryName}:`, error);
			throw new Error(`Repository ${repositoryName} not found`);
		}
	}
}
