import { Op, Transaction, col, fn, literal } from 'sequelize';
import Admin, { IAdmin } from '../../models/admin.model';
import { BadRequestError, NotFoundError } from '../../utils/customErrors';
import { ADMIN_EMAIL } from '../../utils/constants';
import moment from 'moment';
import UserSettings, { IBlockMeta } from '../../models/userSettings.model';
import SupportTicket, { ISupportTicket } from '../../models/supportTicket.model';
import Property, { PropertyStatus } from '../../models/property.model';
import Investment, { InvestmentStatus } from '../../models/investment.model';
import User, { UserType } from '../../models/user.model';
import { TimePeriod } from '../../utils/interface';
import PropertyStats from '../../models/propertyStats.model';

interface TimeSeriesMetric {
    period: string;
    amount: number;
}

interface TimeBasedMetrics {
    revenue: {
        current: number;
        change: {
            amount: number;
            percentage: number;
        };
        chartData: TimeSeriesMetric[];
    };
    newListings: {
        count: number;
        change: {
            amount: number;
            percentage: number;
        };
    };
    newUsers: {
        owners: {
            count: number;
            change: {
                amount: number;
                percentage: number;
            };
        };
        investors: {
            count: number;
            change: {
                amount: number;
                percentage: number;
            };
        };
    };
}

interface OverallMetrics {
    totalProperties: number;
    totalOwners: number;
    totalInvestors: number;
    totalRevenue: number;
}

interface TopPropertyMetrics {
    id: string;
    name: string;
    location: string;
    banner: string;
    totalInvestment: number;
    numberOfInvestors: number;
    yield: number;
    rating: number;
    ownerName: string;
    listingPeriod: {
        start: Date;
        end: Date;
    };
}

export default class AdminService {

    static async createAdmin(adminData: IAdmin): Promise<Admin> {
        const existingAdmin = await Admin.findOne({ where: { email: adminData.email } });
        if (existingAdmin) {
            throw new BadRequestError('Admin with this email already exists');
        }

        const newAdmin = await Admin.create(adminData);
        return newAdmin;
    }

    static async getAllAdmins(): Promise<Admin[]> {
        // exclude the ADMIN_EMAIL from the list of admins
        return Admin.findAll({
            where: {
                email: {
                    [Op.ne]: ADMIN_EMAIL,
                },
            },
        });
    }

    static async getAdminByEmail(email: string): Promise<Admin> {

        const admin: Admin | null = await Admin.findOne({ where: { email } });

        if (!admin) {
            throw new NotFoundError('Admin not found');
        }

        return admin;
    }

    static async deleteAdmin(adminId: string): Promise<void> {
        const admin = await Admin.findByPk(adminId);
        if (!admin) {
            throw new NotFoundError('Admin not found');
        }

        if (admin.email === ADMIN_EMAIL) {
            throw new BadRequestError('Cannot delete the super admin');
        }

        await admin.destroy();
    }

    static async blockUser(id: string, status: boolean, reason: string): Promise<UserSettings> {
        const userSettings = await UserSettings.findOne({ where: { userId: id } });

        if (!userSettings) {
            throw new NotFoundError('User settings not found');
        }

        const currentDate = moment().format('YYYY-MM-DD');
        const updatedMeta: IBlockMeta = userSettings.meta || { blockHistory: [], unblockHistory: [] };

        if (status) {
            // Blocking the user
            if (userSettings.isBlocked) {
                throw new BadRequestError('User is already blocked');
            }
            updatedMeta.blockHistory.push({ [currentDate]: reason });
        } else {
            // Unblocking the user
            if (!userSettings.isBlocked) {
                throw new BadRequestError('User is not blocked');
            }
            updatedMeta.unblockHistory.push({ [currentDate]: reason });
        }

        await userSettings.update({
            isBlocked: status,
            meta: updatedMeta,
        });

        return userSettings;
    }

    static async createTicket(ticketData: ISupportTicket, transaction?: Transaction): Promise<SupportTicket> {
        const { email, name, message, subject, type, userId } = ticketData;
        const ticket = await SupportTicket.create({
            email,
            name,
            message,
            subject,
            type,
            ...(userId && { userId }),
        } as ISupportTicket,
        { transaction });
        return ticket;
    }

    static async getOverallMetrics(): Promise<OverallMetrics> {
        const [totalProperties, totalOwners, totalInvestors, totalRevenue] = await Promise.all([
            Property.count({
                where: { status: PropertyStatus.PUBLISHED },
            }),
            User.count({
                where: { type: UserType.PROJECT_OWNER },
            }),
            User.count({
                where: { type: UserType.INVESTOR },
            }),
            Investment.sum('amount', {
                where: { status: InvestmentStatus.Finish },
            }),
        ]);

        return {
            totalProperties: totalProperties || 0,
            totalOwners: totalOwners || 0,
            totalInvestors: totalInvestors || 0,
            totalRevenue: totalRevenue || 0,
        };
    }

    static async getTimeBasedMetrics(period: TimePeriod = TimePeriod.MONTH): Promise<TimeBasedMetrics> {
        // Calculate date ranges
        const now = new Date();
        const startDate = new Date();
        const previousStartDate = new Date();

        switch (period) {
        case TimePeriod.DAY:
            startDate.setDate(now.getDate() - 30);
            previousStartDate.setDate(startDate.getDate() - 30);
            break;
        case TimePeriod.WEEK:
            startDate.setDate(now.getDate() - 84);
            previousStartDate.setDate(startDate.getDate() - 84);
            break;
        case TimePeriod.MONTH:
            startDate.setMonth(now.getMonth() - 12);
            previousStartDate.setMonth(startDate.getMonth() - 12);
            break;
        }

        // PostgreSQL date truncation format
        const truncFormat = period === TimePeriod.DAY ? 'YYYY-MM-DD' :
            period === TimePeriod.WEEK ? 'IYYY-IW' : 'YYYY-MM';

        // Get time series data for revenue chart with optimization
        const timeSeriesData = await Investment.findAll({
            attributes: [
                [fn('to_char', fn('date_trunc', period, col('date')), truncFormat), 'period'],
                [fn('SUM', col('amount')), 'amount'],
            ],
            where: {
                date: { [Op.between]: [startDate, now] },
                status: InvestmentStatus.Finish,
            },
            group: [fn('to_char', fn('date_trunc', period, col('date')), truncFormat)],
            order: [[fn('to_char', fn('date_trunc', period, col('date')), truncFormat), 'ASC']],
            raw: true,
        }) as unknown as Array<{ period: string; amount: string }>;

        // Optimize metrics queries with parallel execution and specific conditions
        const [
            currentRevenue,
            previousRevenue,
            newListings,
            previousNewListings,
            newOwners,
            previousOwners,
            newInvestors,
            previousInvestors,
        ] = await Promise.all([
            Investment.sum('amount', {
                where: {
                    date: { [Op.between]: [startDate, now] },
                    status: InvestmentStatus.Finish,
                },
            }),
            Investment.sum('amount', {
                where: {
                    date: { [Op.between]: [previousStartDate, startDate] },
                    status: InvestmentStatus.Finish,
                },
            }),
            Property.count({
                where: {
                    createdAt: { [Op.between]: [startDate, now] },
                    status: PropertyStatus.PUBLISHED,
                },
            }),
            Property.count({
                where: {
                    createdAt: { [Op.between]: [previousStartDate, startDate] },
                    status: PropertyStatus.PUBLISHED,
                },
            }),
            User.count({
                where: {
                    createdAt: { [Op.between]: [startDate, now] },
                    type: UserType.PROJECT_OWNER,
                },
            }),
            User.count({
                where: {
                    createdAt: { [Op.between]: [previousStartDate, startDate] },
                    type: UserType.PROJECT_OWNER,
                },
            }),
            User.count({
                where: {
                    createdAt: { [Op.between]: [startDate, now] },
                    type: UserType.INVESTOR,
                },
            }),
            User.count({
                where: {
                    createdAt: { [Op.between]: [previousStartDate, startDate] },
                    type: UserType.INVESTOR,
                },
            }),
        ]);

        // Calculate percentage changes with null safety
        const calculateChange = (current: number, previous: number) => ({
            amount: current - previous,
            percentage: previous > 0 ? ((current - previous) / previous) * 100 : 0,
        });

        return {
            revenue: {
                current: currentRevenue || 0,
                change: calculateChange(currentRevenue || 0, previousRevenue || 0),
                chartData: timeSeriesData.map(data => ({
                    period: period === TimePeriod.WEEK ? `Week ${data.period.split('-')[1]}` : data.period,
                    amount: Number(data.amount) || 0,
                })),
            },
            newListings: {
                count: newListings || 0,
                change: calculateChange(newListings || 0, previousNewListings || 0),
            },
            newUsers: {
                owners: {
                    count: newOwners || 0,
                    change: calculateChange(newOwners || 0, previousOwners || 0),
                },
                investors: {
                    count: newInvestors || 0,
                    change: calculateChange(newInvestors || 0, previousInvestors || 0),
                },
            },
        };
    }

    static async getTopPerformingProperties(limit: number = 10): Promise<TopPropertyMetrics[]> {
        const topProperties = await Property.findAll({
            attributes: [
                'id',
                'name',
                'location',
                'banner',
                'listingPeriod',
                [
                    literal('CONCAT("owner"."firstName", \' \', "owner"."lastName")'),
                    'ownerName',
                ],
            ],
            include: [
                {
                    model: PropertyStats,
                    required: true,
                    as: 'stats',
                    attributes: [
                        'totalInvestmentAmount',
                        'numberOfInvestors',
                        'yield',
                        'overallRating',
                    ],
                },
                {
                    model: User,
                    as: 'owner',
                    attributes: ['firstName', 'lastName'],
                },
            ],
            where: {
                status: PropertyStatus.PUBLISHED,
            },
            order: [
                [{ model: PropertyStats, as: 'stats' }, 'totalInvestmentAmount', 'DESC'],
                [{ model: PropertyStats, as: 'stats' }, 'numberOfInvestors', 'DESC'],
                [{ model: PropertyStats, as: 'stats' }, 'yield', 'DESC'],
                [{ model: PropertyStats, as: 'stats' }, 'overallRating', 'DESC'],
            ],
            limit,
        });

        return topProperties.map(property => ({
            id: property.id,
            name: property.name,
            location: property.location,
            banner: property.banner,
            listingPeriod: property.listingPeriod,
            totalInvestment: property.stats?.totalInvestmentAmount || 0,
            numberOfInvestors: property.stats?.numberOfInvestors || 0,
            yield: property.stats?.yield || 0,
            rating: property.stats?.overallRating || 0,
            ownerName: `${property.owner?.firstName || ''} ${property.owner?.lastName || ''}`.trim(),
        }));
    }

    static async getDetailedPropertyMetrics(propertyId: string): Promise<{
        investmentTrend: TimeSeriesMetric[];
        visitorTrend: TimeSeriesMetric[];
        ratings: { [key: number]: number } & { average: number; total: number };
    }> {
        const [investmentTrend, visitorStats, ratings] = await Promise.all([
            // Get investment trend over time
            Investment.findAll({
                attributes: [
                    [fn('DATE_TRUNC', 'day', col('date')), 'period'],
                    [fn('SUM', col('amount')), 'amount'],
                ],
                where: {
                    propertyId,
                    status: InvestmentStatus.Finish,
                },
                group: [fn('DATE_TRUNC', 'day', col('date'))],
                order: [[fn('DATE_TRUNC', 'day', col('date')), 'ASC']],
                raw: true,
            }) as unknown as Array<{ period: Date; amount: string }>,

            // Get daily visitor count trend (if you have visitor tracking)
            PropertyStats.findOne({
                attributes: ['visitCount'],
                where: { propertyId },
            }),

            // Get rating distribution
            Property.findOne({
                where: { id: propertyId },
                include: [{
                    model: PropertyStats,
                    attributes: ['overallRating', 'ratingCount'],
                }],
            }),
        ]);

        return {
            investmentTrend: investmentTrend.map(trend => ({
                period: moment(trend.period).format('YYYY-MM-DD'),
                amount: Number(trend.amount),
            })),
            visitorTrend: [{
                period: moment().format('YYYY-MM-DD'),
                amount: visitorStats?.visitCount || 0,
            }],
            ratings: {
                1: 0, // You might want to add a ratings distribution to your PropertyStats model
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                average: ratings?.stats?.overallRating || 0,
                total: ratings?.stats?.ratingCount || 0,
            },
        };
    }
}