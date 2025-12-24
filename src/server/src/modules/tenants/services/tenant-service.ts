import type { IBaseCrudService } from "src/server/src/shared/services/base-crud-service";
import type { TenantEntity } from "../entities/tenant-entity";
import { TenantRepository } from "../repositories/tenant-repository";

export class TenantService implements IBaseCrudService {
	private tenantRepository: TenantRepository;
	constructor() {
		this.tenantRepository = new TenantRepository();
	}
	async create(data: Partial<TenantEntity>): Promise<void> {
		try {
			await this.tenantRepository.create(data);
		} catch (error) {
			console.error("Error in TenantService create method:", error);
			throw error;
		}
	}
}
