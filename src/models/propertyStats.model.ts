import { Table, Column, Model, DataType, ForeignKey, BelongsTo, IsUUID } from 'sequelize-typescript';
import Property from './property.model';
import Investment from './investment.model';

@Table
export default class PropertyStats extends Model<PropertyStats | IPropertyStats> {
    @ForeignKey(() => Property)
    @IsUUID(4)
    @Column({ type: DataType.STRING, primaryKey: true })
        propertyId: string;

    @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
        yield: number;

    @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
        totalInvestmentAmount: number;

    @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
        totalEstimatedReturns: number;

    @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
        overallRating: number;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
        numberOfInvestors: number;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
        ratingCount: number;

    @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
        visitCount: number;

    @BelongsTo(() => Property, 'propertyId')
        property: Property;
}

export async function calculateAndUpdateYield(propertyId: string) {
    const investments = await Investment.findAll({
        where: { propertyId },
    });

    let totalInvestment = 0;
    let totalEstimatedReturns = 0;

    investments.forEach(investment => {
        totalInvestment += Number(investment.amount);
        totalEstimatedReturns += Number(investment.estimatedReturns);
    });

    const propertyStats = await PropertyStats.findOne({ where: { propertyId } });
    if (propertyStats) {
        // Calculate yield as percentage: (Total Returns - Total Investment) / Total Investment * 100
        const yieldValue = totalInvestment > 0
            ? ((totalEstimatedReturns - totalInvestment) / totalInvestment) * 100
            : 0;

        propertyStats.yield = Number(yieldValue.toFixed(2));
        propertyStats.totalInvestmentAmount = totalInvestment;
        propertyStats.totalEstimatedReturns = totalEstimatedReturns;
        await propertyStats.save();
    }
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
            yield: 0,
            totalInvestmentAmount: 0,
            totalEstimatedReturns: 0,
        });
    }
}

export async function updatePropertyInvestorCount(propertyId: string, increment: boolean) {
    const propertyStats = await PropertyStats.findOne({ where: { propertyId } });
    if (propertyStats) {
        propertyStats.numberOfInvestors += increment ? 1 : -1;
        propertyStats.numberOfInvestors = Math.max(propertyStats.numberOfInvestors, 0);
        await propertyStats.save();
        // Recalculate yield when investors change
        await calculateAndUpdateYield(propertyId);
    } else {
        await PropertyStats.create({
            propertyId,
            overallRating: 0,
            ratingCount: 0,
            numberOfInvestors: increment ? 1 : 0,
            yield: 0,
            totalInvestmentAmount: 0,
            totalEstimatedReturns: 0,
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
            yield: 0,
            totalInvestmentAmount: 0,
            totalEstimatedReturns: 0,
        });
    }
}

export interface IPropertyStats {
    propertyId: string;
    yield?: number;
    totalInvestmentAmount?: number;
    totalEstimatedReturns?: number;
    overallRating?: number;
    numberOfInvestors?: number;
    ratingCount?: number;
    visitCount?: number;
}