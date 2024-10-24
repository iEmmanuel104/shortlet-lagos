import { Table, Column, Model, DataType, ForeignKey, BelongsTo, IsUUID } from 'sequelize-typescript';
import Property from './property.model';

@Table
export default class Tokenomics extends Model<Tokenomics | ITokenomics> {
    // @IsUUID(4)
    // @PrimaryKey
    // @Default(DataType.UUIDV4)
    // @Column
    // id: string;

    @ForeignKey(() => Property)
    @IsUUID(4)
    @Column({ type: DataType.STRING, primaryKey: true })
        propertyId: string;

    @Column(DataType.INTEGER)
        totalTokenSupply: number;

    @Column(DataType.INTEGER)
        remainingTokens: number;

    @Column(DataType.DECIMAL(10, 2))
        tokenPrice: number;

    @Column(DataType.JSONB)
        distribution: {
        team: number;
        advisors: number;
        investors: number;
        other: number;
    };

    @Column(DataType.TEXT)
        distributionDescription: string;

    @BelongsTo(() => Property, 'propertyId')
        property: Property;
}

export interface ITokenomics {
    propertyId: string;
    totalTokenSupply: number;
    tokenPrice: number;
    distribution: {
        team: number;
        advisors: number;
        investors: number;
        other: number;
    };
    distributionDescription: string;
}
