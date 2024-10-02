import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany, IsUUID, PrimaryKey, Default, HasOne } from 'sequelize-typescript';
import User from './user.model';
import Investment from './investment.model';
import PropertyStats from './propertyStats.model';

@Table
export default class Property extends Model<Property | IProperty> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column
        id: string;

    @Column(DataType.STRING)
        category: string;

    @Column(DataType.STRING)
        name: string;

    @Column(DataType.TEXT)
        description: string;

    @Column(DataType.JSONB)
        location: {
        address: string;
        city: string;
        state: string;
        country: string;
        coordinates: {
            latitude: number;
            longitude: number;
        };
    };

    @Column(DataType.DECIMAL(10, 2))
        price: number;

    @Column(DataType.ARRAY(DataType.STRING))
        gallery: string[];

    @Column(DataType.JSONB)
        metrics: {
            PRY: number;
            PAR: number;
            fund_raising_goal: number;
        };

    @Column(DataType.JSONB)
        shares: {
        total: number;
        remaining: number;
    };

    @Column(DataType.STRING)
        contractAddress: string;

    @ForeignKey(() => User)
    @Column
        ownerId: string;

    
    // Relationships
    @HasOne(() => PropertyStats, { onDelete: 'CASCADE' })
        stats: PropertyStats;

    @BelongsTo(() => User)
        owner: User;

    @HasMany(() => Investment)
        investments: Investment[];
}

export interface IProperty {
    id?: string;
    category: string;
    name: string;
    description: string;
    location: {
        address: string;
        city: string;
        state: string;
        country: string;
        latitude?: number;
        longitude?: number;
    };
    price: number;
    gallery: string[];
    metrics: {
        PRY: number;
        PAR: number;
        fund_raising_goal: number;
    };
    shares: {
        total: number;
        remaining: number;
    };
    contractAddress: string;
    ownerId: string;
}