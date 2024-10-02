import { Table, Column, Model, DataType, ForeignKey, BelongsTo, IsUUID } from 'sequelize-typescript';
import Property from './property.model';

@Table
export default class PropertyStats extends Model<PropertyStats | IPropertyStats> {
    @ForeignKey(() => Property)
    @IsUUID(4)
    @Column({ type: DataType.STRING, primaryKey: true })
        propertyId: string;

    @BelongsTo(() => Property, 'propertyId')
        property: Property;

    @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
        overallRating: number;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
        numberOfInvestors: number;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
        ratingCount: number;
    
    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
        visitCount: number;
}

export async function updatePropertyStatsRating(propertyId: string, newRating: number, isNew: boolean, oldRating?: number) {
    const propertyStats = await PropertyStats.findOne({ where: { propertyId } });
    if (propertyStats) {
        if (isNew) {
            propertyStats.ratingCount += 1;
            propertyStats.overallRating = ((propertyStats.overallRating * (propertyStats.ratingCount - 1)) + newRating) / propertyStats.ratingCount;
        } else if (oldRating !== undefined) {
            const totalRating = (propertyStats.overallRating * propertyStats.ratingCount) - oldRating + newRating;
            propertyStats.overallRating = totalRating / propertyStats.ratingCount;
        } else {
            propertyStats.ratingCount -= 1;
            const totalRating = (propertyStats.overallRating * (propertyStats.ratingCount + 1)) - newRating;
            propertyStats.overallRating = propertyStats.ratingCount > 0 ? totalRating / propertyStats.ratingCount : 0;
        }

        // Ensure the values do not go negative
        propertyStats.ratingCount = Math.max(propertyStats.ratingCount, 0);
        propertyStats.overallRating = Math.max(propertyStats.overallRating, 0);
        await propertyStats.save();
    } else {
        await PropertyStats.create({
            propertyId,
            overallRating: newRating,
            ratingCount: 1,
            numberOfInvestors: 0,
        });
    }
}

export async function updatePropertyInvestorCount(propertyId: string, increment: boolean) {
    const propertyStats = await PropertyStats.findOne({ where: { propertyId } });
    if (propertyStats) {
        propertyStats.numberOfInvestors += increment ? 1 : -1;
        propertyStats.numberOfInvestors = Math.max(propertyStats.numberOfInvestors, 0);
        await propertyStats.save();
    } else {
        await PropertyStats.create({
            propertyId,
            overallRating: 0,
            ratingCount: 0,
            numberOfInvestors: increment ? 1 : 0,
        });
    }
}

export async function updatePropertyVisitCount(propertyId: string) {
    const propertyStats = await PropertyStats.findOne({ where: { propertyId } });
    if (propertyStats) {
        propertyStats.visitCount += 1;
        await propertyStats.save();
    } else {
        await PropertyStats.create({
            propertyId,
            overallRating: 0,
            ratingCount: 0,
            numberOfInvestors: 0,
            visitCount: 1,
        });
    }
}

export interface IPropertyStats {
    propertyId: string;
    overallRating?: number;
    numberOfInvestors?: number;
    ratingCount?: number;
}
