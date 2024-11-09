/* eslint-disable no-unused-vars */
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany, IsUUID, PrimaryKey, Default, HasOne, BelongsToMany } from 'sequelize-typescript';
import User from './user.model';
import Investment from './investment.model';
import PropertyStats from './propertyStats.model';
import Tokenomics from './tokenomics.model';
import Blog from './blog.model';
import BlogProperty from './blogProperty.model';

export enum PropertyStatus {
    DRAFT = 'draft',
    UNDER_REVIEW = 'under_review',
    PUBLISHED = 'published',
    SOLD = 'sold',
}

@Table
export default class Property extends Model<Property | IProperty> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column
        id: string;

    @Column(DataType.ARRAY(DataType.STRING))
        category: string[];

    @Column(DataType.STRING)
        name: string;

    @Column(DataType.TEXT)
        description: string;

    @Column(DataType.STRING)
        location: string;

    @Column(DataType.DECIMAL(10, 2))
        price: number;

    @Column(DataType.ARRAY(DataType.STRING))
        gallery: string[];

    @Column(DataType.STRING)
        banner: string;

    @Column(DataType.ARRAY(DataType.STRING))
        document: string[];

    @Column({
        type: DataType.ENUM,
        values: Object.values(PropertyStatus),
        defaultValue: PropertyStatus.DRAFT,
    })
        status: PropertyStatus;

    @Column(DataType.STRING)
        contractAddress: string;

    @Column(DataType.JSONB)
        listingPeriod: {
        start: Date;
        end: Date;
    };

    @Column(DataType.JSONB)
        metrics: {
            TIG: number; // Total Investment Goal
            MIA: number; // Minimum Investment Amount
            PAR?: number; // Price to Rent Ratio
        };

    @ForeignKey(() => User)
    @Column
        ownerId: string;

    // Relationships
    @HasOne(() => PropertyStats, { onDelete: 'CASCADE' })
        stats: PropertyStats;

    @HasOne(() => Tokenomics, { onDelete: 'CASCADE' })
        tokenomics: Tokenomics;

    @BelongsTo(() => User)
        owner: User;

    @HasMany(() => Investment)
        investments: Investment[];

    @BelongsToMany(() => Blog, () => BlogProperty)
        blogs: Blog[];
}

export interface IProperty {
    id?: string;
    category: string[];
    name: string;
    description: string;
    location: string;
    price: number;
    gallery?: string[];
    banner?: string;
    document?: string[];
    status: PropertyStatus;
    contractAddress?: string;
    listingPeriod: {
        start: Date;
        end: Date;
    };
    metrics: {
        TIG: number;
        MIA: number;
        PAR?: number;
    };
    ownerId: string;
}