import { Column, Entity, Generated, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class TenantEntity {
	@PrimaryGeneratedColumn("uuid")
	uuid!: string;

	@Column("integer")
	@Generated("increment")
	code!: number;

	@Column("text")
	slug!: string;

	@Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
	createdAt!: Date;

	@Column({
		type: "timestamp",
		default: () => "CURRENT_TIMESTAMP",
		onUpdate: "CURRENT_TIMESTAMP",
	})
	updatedAt!: Date;
}
