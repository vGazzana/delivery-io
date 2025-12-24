export interface IBaseCrudService {
	create<T>(data: Partial<T>): Promise<void>;
}
