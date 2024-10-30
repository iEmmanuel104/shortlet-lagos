/* eslint-disable no-unused-vars */
import { Transaction, Op, Includeable, col, fn, literal } from 'sequelize';
import Property, { IProperty } from '../models/property.model';
import User from '../models/user.model';
import Investment, { InvestmentStatus } from '../models/investment.model';
import { BadRequestError, NotFoundError } from '../utils/customErrors';
import Pagination, { IPaging } from '../utils/pagination';
import PropertyStats, { updatePropertyVisitCount } from '../models/propertyStats.model';
import Tokenomics, { ITokenomics } from '../models/tokenomics.model';

export interface IViewPropertiesQuery {
    page?: number;
    size?: number;
    q?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    ownerId?: string;
}

interface IPropertyOwnerStats {
    totalListings: number;
    activeListings: number;
    totalInvestmentAmount: number;
    totalInvestorsCount: number;
    investments: {
        completed: {
            count: number;
            percentageChange: number;
        };
        pending: {
            count: number;
            percentageChange: number;
        };
    };
    recentActivity: {
        newInvestors: number;
        newInvestments: number;
    };
}

export enum TimePeriod {
    DAY = 'day',
    WEEK = 'week',
    MONTH = 'month'
}

// Stats data point interface
interface TimeBasedStats {
    period: string;
    investmentAmount: number;
    investorCount: number;
}

// Time series data interface
interface TimeSeriesData {
    period: TimePeriod;
    data: TimeBasedStats[];
}

// Extended stats interface
export interface IPropertyOwnerStatsWithTimeSeries extends IPropertyOwnerStats {
    timeSeriesData?: TimeSeriesData;
}

export default class PropertyService {
    static async addProperty(propertyData: IProperty, transaction?: Transaction): Promise<Property> {
        const newProperty = await Property.create({ ...propertyData }, { transaction });
        if (newProperty) await PropertyStats.create({ propertyId: newProperty.id }, { transaction });
        return newProperty;
    }

    static async updateProperty(property: Property, dataToUpdate: Partial<IProperty>): Promise<Property> {
        const currentData = property.toJSON();

        // Ensure arrays are properly handled
        const updatedData = {
            ...currentData,
            ...dataToUpdate,
            // Preserve arrays if they're not being updated
            gallery: dataToUpdate.gallery || currentData.gallery || [],
            document: dataToUpdate.document || currentData.document || [],
            category: Array.isArray(dataToUpdate.category)
                ? dataToUpdate.category
                : typeof dataToUpdate.category === 'string'
                    ? JSON.parse(dataToUpdate.category)
                    : currentData.category || [],
        };

        // Update the property with the processed data
        await property.update(updatedData);

        // Fetch the updated property
        const updatedProperty = await this.viewProperty(property.id);
        return updatedProperty;
    }

    static async deleteProperty(property: Property, transaction?: Transaction): Promise<void> {
        transaction ? await property.destroy({ transaction }) : await property.destroy();
    }

    static async viewProperty(id: string, isUserRequest: boolean = false): Promise<Property> {
        const include: Includeable[] = [
            {
                model: User,
                as: 'owner',
                attributes: ['id', 'username', 'email'],
            },
            {
                model: Investment,
                as: 'investments',
                attributes: ['id', 'amount', 'date', 'sharesAssigned', 'estimatedReturns', 'status'],
            },
            {
                model: PropertyStats,
                as: 'stats',
                attributes: ['yield', 'totalInvestmentAmount', 'totalEstimatedReturns', 'overallRating', 'numberOfInvestors', 'ratingCount', 'visitCount'],
            },
            {
                model: Tokenomics,
                attributes: ['totalTokenSupply', 'remainingTokens', 'tokenPrice', 'distribution', 'distributionDescription'],
            },
        ];

        const property: Property | null = await Property.findByPk(id, { include });

        if (!property) {
            throw new NotFoundError('Property not found');
        }

        if (isUserRequest) {
            await updatePropertyVisitCount(id);
            // Refresh the property to get the updated stats
            await property.reload();
        }

        return property;
    }

    static async viewProperties(queryData?: IViewPropertiesQuery): Promise<{ properties: Property[], count?: number, totalPages?: number }> {
        let conditions: Record<string, unknown> = {};
        let paginate = false;
        const { page, size, q: query, category, minPrice, maxPrice, ownerId } = queryData as IViewPropertiesQuery;

        if (page && size && page > 0 && size > 0) {
            const { limit, offset } = Pagination.getPagination({ page, size } as IPaging);
            conditions = { limit, offset };
            paginate = true;
        }

        let where = {};

        // Enhanced search query handling
        if (query !== undefined && query !== '') {
            const searchTerm = query.trim().toLowerCase();
            where = {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${searchTerm}%` } },
                    { description: { [Op.iLike]: `%${searchTerm}%` } },
                    { location: { [Op.iLike]: `%${searchTerm}%` } },
                    // // Search within category array
                    // {
                    //     category: {
                    //         [Op.overlap]: [searchTerm],
                    //     },
                    // },
                    // // Search for partial matches in category array
                    // {
                    //     category: {
                    //         [Op.any]: {
                    //             [Op.iLike]: `%${searchTerm}%`,
                    //         },
                    //     },
                    // },
                ],
            };
        }

        // Category filter handling
        if (category) {
            where = {
                ...where,
                category: {
                    [Op.contains]: Array.isArray(category) ? category : [category],
                },
            };
        }

        // Price range handling
        if (minPrice !== undefined || maxPrice !== undefined) {
            where = { ...where, price: {} };
            if (minPrice !== undefined) where = { ...where, price: { [Op.gte]: minPrice } };
            if (maxPrice !== undefined) where = { ...where, price: { [Op.lte]: maxPrice } };
        }

        // Owner filter
        if (ownerId) {
            where = { ...where, ownerId };
        }

        const { rows: properties, count }: { rows: Property[], count: number } = await Property.findAndCountAll({
            ...conditions,
            where,
            order: [['updatedAt', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'owner',
                    attributes: ['id', 'username', 'email'],
                },
                {
                    model: PropertyStats,
                    as: 'stats',
                    attributes: ['overallRating', 'numberOfInvestors', 'ratingCount', 'visitCount'],
                },
            ],
            distinct: true, // Ensure correct count when using includes
        });

        if (paginate && properties.length > 0) {
            const totalPages = Pagination.estimateTotalPage({ count, limit: size } as IPaging);
            return { properties, count, ...totalPages };
        } else return { properties };
    }

    static async getPropertyOwnerStats(
        ownerId: string,
        includeTimeSeries: boolean = false,
        period?: TimePeriod
    ): Promise<IPropertyOwnerStatsWithTimeSeries> {
        // Get basic stats first
        const baseStats = await this.getBasicPropertyOwnerStats(ownerId);

        if (!includeTimeSeries || !period) {
            return baseStats;
        }

        // Get time series data if requested
        const timeSeriesStats = await this.getTimeSeriesStats(ownerId, period);

        return {
            ...baseStats,
            timeSeriesData: {
                period,
                data: timeSeriesStats,
            },
        };
    }

    private static async getBasicPropertyOwnerStats(ownerId: string): Promise<IPropertyOwnerStats> {

        // Get all properties by owner
        const properties = await Property.findAll({
            where: { ownerId },
            include: [
                {
                    model: PropertyStats,
                    attributes: ['numberOfInvestors', 'totalInvestmentAmount'],
                },
                {
                    model: Investment,
                    attributes: ['id', 'amount', 'status', 'createdAt', 'investorId'],
                    include: [
                        {
                            model: User,
                            as: 'investor',
                            attributes: ['id'],
                        },
                    ],
                },
            ],
        });

        // Calculate total listings and active listings
        const totalListings = properties.length;
        const activeListings = properties.filter(p => !p.isDraft).length;

        // Aggregate investment data
        let totalInvestmentAmount = 0;
        const totalInvestorsSet = new Set();
        let completedInvestments = 0;
        let pendingInvestments = 0;
        let lastMonthCompletedInvestments = 0;
        let lastMonthPendingInvestments = 0;
        let newInvestorsLastMonth = 0;
        let newInvestmentsLastMonth = 0;

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        properties.forEach(property => {
            // Sum up total investment amount
            totalInvestmentAmount += property.stats?.totalInvestmentAmount || 0;

            // Process investments
            property.investments?.forEach(investment => {
                // Count unique investors
                totalInvestorsSet.add(investment.investorId);

                // Count investments by status
                if (investment.status === InvestmentStatus.Finish) {
                    completedInvestments++;
                    if (new Date(investment.createdAt) > oneMonthAgo) {
                        lastMonthCompletedInvestments++;
                    }
                } else {
                    pendingInvestments++;
                    if (new Date(investment.createdAt) > oneMonthAgo) {
                        lastMonthPendingInvestments++;
                    }
                }

                // Count new investments and investors in last month
                if (new Date(investment.createdAt) > oneMonthAgo) {
                    newInvestmentsLastMonth++;
                    if (property.stats?.numberOfInvestors) {
                        newInvestorsLastMonth++;
                    }
                }
            });
        });

        // Calculate percentage changes
        const completedPercentageChange = lastMonthCompletedInvestments > 0
            ? ((lastMonthCompletedInvestments / completedInvestments) * 100)
            : 0;

        const pendingPercentageChange = lastMonthPendingInvestments > 0
            ? ((lastMonthPendingInvestments / pendingInvestments) * 100)
            : 0;

        return {
            totalListings,
            activeListings,
            totalInvestmentAmount,
            totalInvestorsCount: totalInvestorsSet.size,
            investments: {
                completed: {
                    count: completedInvestments,
                    percentageChange: completedPercentageChange,
                },
                pending: {
                    count: pendingInvestments,
                    percentageChange: pendingPercentageChange,
                },
            },
            recentActivity: {
                newInvestors: newInvestorsLastMonth,
                newInvestments: newInvestmentsLastMonth,
            },
        };
    }

    private static async getTimeSeriesStats(
        ownerId: string,
        period: TimePeriod
    ): Promise<TimeBasedStats[]> {
        // Get all properties for this owner
        const properties = await Property.findAll({
            attributes: ['id'],
            where: { ownerId },
            raw: true,
        });

        const propertyIds = properties.map(p => p.id);

        if (propertyIds.length === 0) {
            return [];
        }

        // PostgreSQL date truncation format
        const truncFormat = period === TimePeriod.DAY ? 'YYYY-MM-DD' :
            period === TimePeriod.WEEK ? 'IYYY-IW' : 'YYYY-MM';

        // Calculate the start date based on period
        const startDate = new Date();
        switch (period) {
        case TimePeriod.DAY:
            startDate.setDate(startDate.getDate() - 30); // Last 30 days
            break;
        case TimePeriod.WEEK:
            startDate.setDate(startDate.getDate() - 84); // Last 12 weeks
            break;
        case TimePeriod.MONTH:
            startDate.setMonth(startDate.getMonth() - 12); // Last 12 months
            break;
        }

        const stats = await Investment.findAll({
            attributes: [
                [fn('to_char', fn('date_trunc', period, col('createdAt')), truncFormat), 'period'],
                [fn('SUM', col('amount')), 'investmentAmount'],
                [fn('COUNT', literal('DISTINCT "investorId"')), 'investorCount'],
            ],
            where: {
                propertyId: {
                    [Op.in]: propertyIds,
                },
                createdAt: {
                    [Op.gte]: startDate,
                },
            },
            group: [fn('to_char', fn('date_trunc', period, col('createdAt')), truncFormat)],
            order: [[fn('to_char', fn('date_trunc', period, col('createdAt')), truncFormat), 'ASC']],
            raw: true,
        }) as unknown as Array<{ period: string; investmentAmount: string; investorCount: string }>;

        return stats.map(stat => ({
            period: period === TimePeriod.WEEK ? `Week ${stat.period.split('-')[1]}` : stat.period,
            investmentAmount: Number(stat.investmentAmount),
            investorCount: Number(stat.investorCount),
        }));
    }

    static async updatePropertyTokenomics(propertyId: string, tokenomicsData: ITokenomics): Promise<Property> {
        await this.validateTokenomicsData(tokenomicsData);

        const property = await Property.findByPk(propertyId, {
            include: [{ model: Tokenomics }],
        });

        if (!property) {
            throw new BadRequestError('Property not found');
        }

        // Validate required media before publishing
        await this.validatePropertyMedia(property);

        if (property.tokenomics) {
            // Update existing tokenomics
            await property.tokenomics.update({
                ...tokenomicsData,
                remainingTokens: tokenomicsData.totalTokenSupply,
                propertyId,
            });
        } else {
            // Create new tokenomics record
            await Tokenomics.create({
                ...tokenomicsData,
                remainingTokens: tokenomicsData.totalTokenSupply,
                propertyId,
            } as ITokenomics);
        }

        // Update property draft status
        await property.update({ isDraft: false });

        // Reload property with updated tokenomics
        const updatedProperty = await Property.findByPk(propertyId, {
            include: [{
                model: Tokenomics,
                attributes: [
                    'totalTokenSupply',
                    'remainingTokens',
                    'tokenPrice',
                    'distribution',
                    'distributionDescription',
                ],
            }],
        });

        if (!updatedProperty) {
            throw new BadRequestError('Failed to reload property after tokenomics update');
        }

        return updatedProperty;
    }

    static async validatePropertyData(data: Partial<IProperty>): Promise<Partial<IProperty>> {
        const { category, name, description, location, metrics, listingPeriod } = data;
        const missingFields = [];

        if (!category) missingFields.push('category');
        if (!name) missingFields.push('name');
        if (!description) missingFields.push('description');
        if (!location) missingFields.push('location');
        if (!metrics?.TIG) missingFields.push('Total Investment Goal (TIG)');
        if (!metrics?.MIA) missingFields.push('Minimum Investment Amount (MIA)');
        if (!listingPeriod?.start) missingFields.push('listingPeriod start date');
        if (!listingPeriod?.end) missingFields.push('listingPeriod end date');

        if (missingFields.length > 0) {
            throw new BadRequestError(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Validate listing period
        if (!listingPeriod) {
            throw new BadRequestError('Listing period is required');
        }
        const start = new Date(listingPeriod.start);
        const end = new Date(listingPeriod.end);
        if (start >= end) {
            throw new BadRequestError('Listing end date must be after start date');
        }

        // Parse category if it's a string
        let parsedCategory = category;
        if (typeof category === 'string') {
            try {
                parsedCategory = JSON.parse(category);
            } catch (error) {
                // If it's a single category as string, convert to array
                parsedCategory = [category];
            }
        }

        // Return the validated and parsed data
        return {
            ...data,
            category: parsedCategory,
            price: metrics?.MIA,
        };
    }

    static async validatePropertyMedia(property: Property): Promise<void> {
        if (!property.banner) {
            throw new BadRequestError('Property banner is required');
        }
        if (!property.gallery || property.gallery.length === 0) {
            throw new BadRequestError('At least one gallery image is required');
        }
        if (!property.document || property.document.length === 0) {
            throw new BadRequestError('At least one document is required');
        }
    }

    static async validateTokenomicsData(data: ITokenomics): Promise<void> {
        const { totalTokenSupply, tokenPrice, distribution, distributionDescription } = data;
        const missingFields = [];

        if (!totalTokenSupply || totalTokenSupply <= 0) missingFields.push('totalTokenSupply');
        if (!tokenPrice || tokenPrice <= 0) missingFields.push('tokenPrice');
        if (!distribution) missingFields.push('distribution');
        if (!distributionDescription) missingFields.push('distributionDescription');

        if (missingFields.length > 0) {
            throw new BadRequestError(`Missing or invalid tokenomics fields: ${missingFields.join(', ')}`);
        }

        // Validate distribution percentages sum to 100
        const { team, advisors, investors, other } = distribution;
        const total = (team || 0) + (advisors || 0) + (investors || 0) + (other || 0);

        if (total !== 100) {
            throw new BadRequestError('Distribution percentages must sum to 100%');
        }

        // Validate distribution values are non-negative
        Object.entries(distribution).forEach(([key, value]) => {
            if (value < 0) {
                throw new BadRequestError(`Distribution ${key} percentage cannot be negative`);
            }
        });
    }
}