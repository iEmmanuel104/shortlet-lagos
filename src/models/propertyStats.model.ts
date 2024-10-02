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
        numberOfPaidStudents: number;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
        ratingCount: number;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
        numberOfModules: number;
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
            numberOfPaidStudents: 0,
            numberOfModules: 0,
        });
    }
}

export async function updatePropertyStatsPaidStudents(propertyId: string, increment: boolean) {
    const propertyStats = await PropertyStats.findOne({ where: { propertyId } });
    if (propertyStats) {
        propertyStats.numberOfPaidStudents += increment ? 1 : -1;
        propertyStats.numberOfPaidStudents = Math.max(propertyStats.numberOfPaidStudents, 0);
        await propertyStats.save();
    } else {
        await PropertyStats.create({
            propertyId,
            overallRating: 0,
            ratingCount: 0,
            numberOfPaidStudents: increment ? 1 : 0,
            numberOfModules: 0,
        });
    }
}

export async function updatePropertyStatsModules(propertyId: string, increment: boolean) {
    const propertyStats = await PropertyStats.findOne({ where: { propertyId } });
    if (propertyStats) {
        propertyStats.numberOfModules += increment ? 1 : -1;
        propertyStats.numberOfModules = Math.max(propertyStats.numberOfModules, 0);
        await propertyStats.save();
    } else {
        await PropertyStats.create({
            propertyId,
            overallRating: 0,
            ratingCount: 0,
            numberOfPaidStudents: 0,
            numberOfModules: increment ? 1 : 0,
        });
    }
}

export interface IPropertyStats {
    propertyId: string;
    overallRating?: number;
    numberOfPaidStudents?: number;
    ratingCount?: number;
    numberOfModules?: number;
}
