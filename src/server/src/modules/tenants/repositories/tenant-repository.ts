import { BaseRepository } from "src/server/src/shared/repositories/base-repository";
import type { Repository } from "typeorm";
import { TenantEntity } from "../entities/tenant-entity";

export class TenantRepository extends BaseRepository {
	private repository: Repository<TenantEntity>;
	constructor(private readonly repositoryName = "tenants") {
		super();
		this.repository = this.getRepository<TenantEntity>(this.repositoryName);
	}

	async create(data: Partial<TenantEntity>): Promise<void> {
		try {
			const newTenant = new TenantEntity();
			Object.assign(newTenant, data);
			this.repository.save(newTenant);
		} catch (error) {
			console.error(error);
			throw new Error("Error creating tenant");
		}
	}

	async findAll(): Promise<TenantEntity[]> {
		try {
			const tenants = await this.repository.find();
			return tenants;
		} catch (error) {
			console.error(error);
			throw new Error("Error finding all tenants");
		}
	}

	async findById(uuid: string): Promise<TenantEntity | null> {
		try {
			const tenant = await this.repository.findOneBy({ uuid });
			return tenant;
		} catch (error) {
			console.error(error);
			throw new Error("Error finding tenant by ID");
		}
	}
}
