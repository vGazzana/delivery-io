export interface JWTPayload {
	userId: number;
	email: string;
	tenantId: string;
	role: "admin" | "funcionario" | "motoboy";
	iat?: number;
	exp?: number;
}

export interface TokenPair {
	accessToken: string;
	refreshToken: string;
}
