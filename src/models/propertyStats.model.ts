import { Table, Column, Model, DataType, ForeignKey, BelongsTo, IsUUID } from 'sequelize-typescript';
import Property from './property.model';
import Investment, { InvestmentStatus } from './investment.model';

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
    const property = await Property.findByPk(propertyId, {
        include: [
            {
                model: Investment,
                where: { status: InvestmentStatus.Finish },
            },
        ],
    });

    if (!property) return;

    let totalInvestment = 0;
    let totalEstimatedReturns = 0;
    const activeInvestors = new Set();

    property.investments.forEach(investment => {
        const amount = Number(investment.amount);
        const returns = Number(investment.estimatedReturns);

        if (!isNaN(amount) && !isNaN(returns)) {
            totalInvestment += amount;
            totalEstimatedReturns += returns;
            activeInvestors.add(investment.investorId);
        }
    });

    // Calculate annual yield rate
    const annualYield = totalInvestment > 0
        ? ((totalEstimatedReturns - totalInvestment) / totalInvestment) * 100
        : 0;

    // Update or create property stats
    const [propertyStats] = await PropertyStats.findOrCreate({
        where: { propertyId },
        defaults: {
            propertyId,
            yield: 0,
            totalInvestmentAmount: 0,
            totalEstimatedReturns: 0,
            numberOfInvestors: 0,
        },
    });

    await propertyStats.update({
        yield: Number(annualYield.toFixed(2)),
        totalInvestmentAmount: Number(totalInvestment.toFixed(2)),
        totalEstimatedReturns: Number(totalEstimatedReturns.toFixed(2)),
        numberOfInvestors: activeInvestors.size,
    });
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