export type GatewayConfig = {
	port: number;
	host: string;
};

export interface IGateway {
	bootstrap(config: GatewayConfig): Promise<void>;
}
