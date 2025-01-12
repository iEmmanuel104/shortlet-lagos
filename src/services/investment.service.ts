import { Transaction, Op, Includeable, WhereOptions, col, fn, literal } from 'sequelize';
import Investment, { IInvestment, InvestmentStatus } from '../models/investment.model';
import Property from '../models/property.model';
import User from '../models/user.model';
import { BadRequestError, NotFoundError } from '../utils/customErrors';
import Pagination, { IPaging } from '../utils/pagination';
import PropertyStats from '../models/propertyStats.model';
import { IInvestorStats, MetricsPeriod, IInvestmentMetrics, ITopInvestment, IInvestmentOverview } from '../utils/interface';
import Tokenomics from '../models/tokenomics.model';

export interface IViewInvestmentsQuery {
    page?: number;
    size?: number;
    status?: InvestmentStatus;
    propertyId?: string;
    investorId?: string;
    minAmount?: number;
    maxAmount?: number;
}

export default class InvestmentService {
    static async addInvestment(investmentData: Partial<IInvestment>): Promise<Investment> {
        const { propertyId, amount, sharesAssigned, investorId } = investmentData;

        // Validate essential fields
        if (!propertyId || !amount || !sharesAssigned || !investorId) {
            throw new BadRequestError('Missing required investment fields');
        }

        // Fetch property details to calculate returns
        const property = await Property.findByPk(propertyId, {
            include: [{ model: PropertyStats }, { model: User, as: 'owner' }],
        });

        if (!property) {
            throw new NotFoundError('Property not found');
        }

        // Calculate estimated returns based on property metrics and tokenomics
        const annualYield = property.stats?.yield || 15; // Default 15% if not set
        const estimatedReturns = amount * (1 + (annualYield / 100));

        // Create complete investment record
        const completeInvestmentData: IInvestment = {
            propertyId,
            amount,
            date: new Date(),
            sharesAssigned,
            estimatedReturns,
            status: InvestmentStatus.Finish, // Set default status
            propertyOwner: property.owner.id,
            investorId,
        };

        const newInvestment = await Investment.create(completeInvestmentData);

        // Property stats will be updated via Investment model hooks
        return newInvestment;
    }

    static async updateInvestment(investment: Investment, dataToUpdate: Partial<IInvestment>): Promise<Investment> {
        await investment.update(dataToUpdate);
        const updatedInvestment = await this.viewInvestment(investment.id);
        return updatedInvestment;
    }

    static async deleteInvestment(investment: Investment, transaction?: Transaction): Promise<void> {
        transaction ? await investment.destroy({ transaction }) : await investment.destroy();
    }

    static async viewInvestment(id: string): Promise<Investment> {
        const include: Includeable[] = [
            {
                model: Property,
                attributes: ['id', 'name', 'category', 'price'],
            },
            {
                model: User,
                as: 'investor',
                attributes: ['id', 'username', 'email'],
            },
        ];

        const investment: Investment | null = await Investment.findByPk(id, { include });

        if (!investment) {
            throw new NotFoundError('Investment not found');
        }

        return investment;
    }

    static async viewInvestments(queryData?: IViewInvestmentsQuery): Promise<{ investments: Investment[], count?: number, totalPages?: number }> {
        let conditions: Record<string, unknown> = {};
        let paginate = false;
        const { page, size, status, propertyId, investorId, minAmount, maxAmount } = queryData as IViewInvestmentsQuery;

        if (page && size && page > 0 && size > 0) {
            const { limit, offset } = Pagination.getPagination({ page, size } as IPaging);
            conditions = { limit, offset };
            paginate = true;
        }

        const where: WhereOptions = {};

        if (status) {
            where.status = status;
        }

        if (propertyId) {
            where.propertyId = propertyId;
        }

        if (investorId) {
            where.investorId = investorId;
        }

        if (minAmount !== undefined || maxAmount !== undefined) {
            where.amount = {};
            if (minAmount !== undefined) where.amount[Op.gte] = minAmount;
            if (maxAmount !== undefined) where.amount[Op.lte] = maxAmount;
        }

        const { rows: investments, count }: { rows: Investment[], count: number } = await Investment.findAndCountAll({
            ...conditions,
            where,
            order: [['date', 'DESC']],
            include: [
                {
                    model: Property,
                    attributes: ['id', 'name', 'category', 'price'],
                },
                {
                    model: User,
                    as: 'investor',
                    attributes: ['id', 'username', 'email'],
                },
            ],
        });

        if (paginate && investments.length > 0) {
            const totalPages = Pagination.estimateTotalPage({ count, limit: size } as IPaging);
            return { investments, count, ...totalPages };
        } else return { investments };
    }

    static async validateInvestmentData(data: Partial<IInvestment>): Promise<Partial<IInvestment>> {
        const { propertyId, amount, sharesAssigned, investorId } = data;

        const missingFields = [];

        if (!propertyId) missingFields.push('propertyId');
        if (!amount) missingFields.push('amount');
        if (!sharesAssigned) missingFields.push('sharesAssigned');
        // if (!estimatedReturns) missingFields.push('estimatedReturns');
        // if (!status) missingFields.push('status');
        // if (!propertyOwner) missingFields.push('propertyOwner');
        if (!investorId) missingFields.push('investorId');

        if (missingFields.length > 0) {
            throw new BadRequestError(`Missing or invalid fields: ${missingFields.join(', ')}`);
        }

        // Additional validations can be added here

        return data;
    }

    static async getInvestorStats(investorId: string): Promise<IInvestorStats> {
        const investments = await Investment.findAll({
            where: { investorId },
            include: [{
                model: Property,
                include: [
                    { model: PropertyStats },
                    { model: Tokenomics },
                ],
            }],
        });

        let totalInvestedAmount = 0;
        let currentValue = 0;
        let processingCount = 0;
        let processingAmount = 0;
        let completedCount = 0;
        let completedAmount = 0;
        let totalRentEarned = 0;
        let pendingRent = 0;
        let totalPropertyValue = 0;
        let initialPropertyValue = 0;

        investments.forEach(investment => {
            const amount = Number(investment.amount);
            totalInvestedAmount += amount;

            // Calculate current value based on property stats and share ratio
            const propertyStats = investment.property?.stats;
            const tokenomics = investment.property?.tokenomics;

            if (propertyStats) {
                // Safe calculation of share ratio with fallback
                const totalTokenSupply = tokenomics?.totalTokenSupply || investment.property?.metrics?.TIG || 1;
                const shareRatio = investment.sharesAssigned / totalTokenSupply;

                const currentPropertyValue = propertyStats.totalEstimatedReturns;
                const investmentValue = currentPropertyValue * shareRatio;
                currentValue += investmentValue;

                // Track property values
                totalPropertyValue += currentPropertyValue;
                initialPropertyValue += (investment.property?.metrics?.TIG || 0) * shareRatio;
            }

            // Track investment status
            if (investment.status === InvestmentStatus.Finish) {
                completedCount++;
                completedAmount += amount;
            } else {
                processingCount++;
                processingAmount += amount;
            }

            // Calculate rental income with safe checks
            const investmentDate = new Date(investment.date);
            const monthsSinceInvestment = Math.floor(
                (new Date().getTime() - investmentDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            );
            const monthlyRent = (investment.estimatedReturns - amount) / 12;

            if (!isNaN(monthlyRent) && monthsSinceInvestment > 0) {
                totalRentEarned += monthlyRent * monthsSinceInvestment;
                pendingRent += monthlyRent;
            }
        });

        // Safe calculation of value changes with zero checks
        const valueChange = {
            amount: currentValue - totalInvestedAmount,
            percentage: totalInvestedAmount > 0
                ? ((currentValue - totalInvestedAmount) / totalInvestedAmount) * 100
                : 0,
        };

        const propertyValueChange = {
            amount: totalPropertyValue - initialPropertyValue,
            percentage: initialPropertyValue > 0
                ? ((totalPropertyValue - initialPropertyValue) / initialPropertyValue) * 100
                : 0,
        };

        return {
            totalInvestments: investments.length,
            totalInvestedAmount,
            accountValue: currentValue,
            valueChange,
            investments: {
                processing: {
                    count: processingCount,
                    amount: processingAmount,
                },
                completed: {
                    count: completedCount,
                    amount: completedAmount,
                },
            },
            rentals: {
                balance: pendingRent,
                totalEarned: totalRentEarned,
                pendingPayouts: pendingRent,
            },
            portfolio: {
                totalPropertyValue,
                valueChange: propertyValueChange,
            },
        };
    }

    static async getInvestmentMetrics(investorId: string, period: MetricsPeriod): Promise<IInvestmentMetrics[]> {
        // Calculate date range based on period
        const startDate = new Date();
        switch (period) {
        case MetricsPeriod.DAY:
            startDate.setDate(startDate.getDate() - 30); // Last 30 days
            break;
        case MetricsPeriod.WEEK:
            startDate.setDate(startDate.getDate() - 84); // Last 12 weeks
            break;
        case MetricsPeriod.MONTH:
            startDate.setMonth(startDate.getMonth() - 12); // Last 12 months
            break;
        case MetricsPeriod.SIXMONTH:
            startDate.setMonth(startDate.getMonth() - 6); // Last 6 months
            break;
        case MetricsPeriod.YEAR:
            startDate.setFullYear(startDate.getFullYear() - 1); // Last year
            break;
        case MetricsPeriod.FIVEYEAR:
            startDate.setFullYear(startDate.getFullYear() - 5); // Last 5 years
            break;
        }

        const truncFormat = period === MetricsPeriod.DAY ? 'YYYY-MM-DD' :
            period === MetricsPeriod.WEEK ? 'IYYY-IW' : 'YYYY-MM';

        const metrics = await Investment.findAll({
            attributes: [
                [fn('to_char', fn('date_trunc', period, col('date')), truncFormat), 'period'],
                [fn('SUM', col('amount')), 'investedAmount'],
                [fn('SUM', col('estimatedReturns')), 'propertyValue'],
                [literal('SUM("estimatedReturns" - "amount") / 12'), 'rentalIncome'], // Fixed column reference
            ],
            where: {
                investorId,
                date: { [Op.gte]: startDate },
            },
            group: [fn('to_char', fn('date_trunc', period, col('date')), truncFormat)],
            order: [[fn('to_char', fn('date_trunc', period, col('date')), truncFormat), 'ASC']],
            raw: true,
        }) as unknown as Array<{
            period: string;
            investedAmount: string;
            propertyValue: string;
            rentalIncome: string;
        }>;

        // Process and format the results
        return metrics.map(metric => ({
            period: period === MetricsPeriod.WEEK ? `Week ${metric.period.split('-')[1]}` : metric.period,
            investedAmount: Number(metric.investedAmount) || 0,
            propertyValue: Number(metric.propertyValue) || 0,
            rentalIncome: Number(metric.rentalIncome) || 0,
        }));
    }

    static async getTopInvestments(investorId: string, limit: number = 5): Promise<ITopInvestment[]> {
        const investments = await Investment.findAll({
            where: { investorId },
            include: [{
                model: Property,
                include: [
                    { model: PropertyStats },
                    { model: Tokenomics },
                ],
            }],
            order: [['amount', 'DESC']],
            limit,
        });

        return investments.map(investment => {
            const tokenomics = investment.property?.tokenomics;
            const totalTokenSupply = tokenomics?.totalTokenSupply || investment.property?.metrics?.TIG || 1;
            const shareRatio = investment.sharesAssigned / totalTokenSupply;

            const initialValue = Number(investment.amount);
            const currentValue = (investment.property?.stats?.totalEstimatedReturns || 0) * shareRatio;

            const valueChange = {
                amount: currentValue - initialValue,
                percentage: initialValue > 0 ? ((currentValue - initialValue) / initialValue) * 100 : 0,
            };

            return {
                propertyId: investment.propertyId,
                propertyName: investment.property?.name || 'Unknown Property',
                location: investment.property?.location || 'Unknown Location',
                investedAmount: initialValue,
                currentValue,
                valueChange,
                rentalYield: investment.property?.stats?.yield || 0,
                investmentDate: investment.date,
            };
        });
    }

    static async getInvestmentsOverview(): Promise<IInvestmentOverview> {
        // Get current period stats with efficient single query
        const currentStats = await Investment.findAll({
            attributes: [
                'status',
                [fn('COUNT', col('id')), 'count'],
                [fn('SUM', col('amount')), 'amount'],
            ],
            group: ['status'],
            raw: true,
        }) as unknown as Array<{
            status: InvestmentStatus;
            count: string;
            amount: string;
        }>;

        // Calculate previous period for comparison
        const previousMonth = new Date();
        previousMonth.setMonth(previousMonth.getMonth() - 1);

        // Get previous period stats efficiently
        const previousStats = await Investment.findAll({
            where: {
                date: {
                    [Op.lt]: previousMonth,
                },
            },
            attributes: [
                'status',
                [fn('COUNT', col('id')), 'count'],
            ],
            group: ['status'],
            raw: true,
        }) as unknown as Array<{
            status: InvestmentStatus;
            count: string;
        }>;

        // Initialize counters using reduce for better performance
        const currentTotals = currentStats.reduce((acc, stat) => {
            const count = parseInt(stat.count);
            const amount = parseFloat(stat.amount) || 0;

            if (stat.status === InvestmentStatus.Finish) {
                acc.completed.count = count;
                acc.completed.amount = amount;
            } else {
                acc.pending.count += count;
                acc.pending.amount += amount;
            }

            acc.total.count += count;
            acc.total.amount += amount;

            return acc;
        }, {
            total: { count: 0, amount: 0 },
            completed: { count: 0, amount: 0 },
            pending: { count: 0, amount: 0 },
        });

        // Calculate previous period totals
        const previousTotals = previousStats.reduce((acc, stat) => {
            const count = parseInt(stat.count);

            if (stat.status === InvestmentStatus.Finish) {
                acc.completed = count;
            } else {
                acc.pending += count;
            }

            return acc;
        }, { completed: 0, pending: 0 });

        // Calculate percentage changes with safe division
        const calculatePercentageChange = (current: number, previous: number): number => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Number(((current - previous) / previous * 100).toFixed(2));
        };

        return {
            totalInvestments: {
                count: currentTotals.total.count,
                amount: currentTotals.total.amount,
            },
            completedInvestments: {
                count: currentTotals.completed.count,
                amount: currentTotals.completed.amount,
                percentageChange: calculatePercentageChange(
                    currentTotals.completed.count,
                    previousTotals.completed
                ),
            },
            pendingInvestments: {
                count: currentTotals.pending.count,
                amount: currentTotals.pending.amount,
                percentageChange: calculatePercentageChange(
                    currentTotals.pending.count,
                    previousTotals.pending
                ),
            },
        };
    }
}