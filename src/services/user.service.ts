import { Transaction, Op, FindAndCountOptions, Includeable, WhereOptions } from 'sequelize';
import User, { IUser } from '../models/user.model';
import { NotFoundError, BadRequestError } from '../utils/customErrors';
import Validator from '../utils/validators';
import Pagination, { IPaging } from '../utils/pagination';
import { Sequelize } from '../models';
import UserSettings, { IUserSettings } from '../models/userSettings.model';
import WithdrawalRequest, { IWithdrawalRequest, WithdrawalStatus } from '../models/withdrawalRequest.model';

export interface IViewUsersQuery {
    page?: number;
    size?: number;
    q?: string;
    isBlocked?: boolean;
    isDeactivated?: boolean;
}

export interface IDynamicQueryOptions {
    query: Record<string, string>;
    includes?: 'profile' | 'all';
    attributes?: string[];
}
export interface IViewWithdrawalRequestsQuery {
    page?: number;
    size?: number;
    userId?: string;
    status?: WithdrawalStatus;
    minAmount?: number;
    maxAmount?: number;
}

export default class UserService {

    static async isWalletAddressEmailAndUserNameAvailable(walletAddress: string, email: string, username: string): Promise<boolean> {
        // Validate email
        if (!Validator.isValidEmail(email)) {
            throw new BadRequestError('Invalid email');
        }

        // Construct where condition
        const whereCondition = {
            [Op.or]: [
                { email: email },
                { walletAddress: walletAddress },
                { username: username },
            ],
        };

        // Find existing users with the given email, wallet address, or username
        const existingUsers = await User.findAll({
            where: whereCondition,
            attributes: ['email', 'walletAddress', 'username'],
        });

        // Check for conflicts and collect them
        const conflicts: string[] = [];
        for (const user of existingUsers) {
            if (user.email === email) {
                conflicts.push('email');
            }
            if (user.walletAddress === walletAddress) {
                conflicts.push('wallet address');
            }
            if (user.username === username) {
                conflicts.push('username');
            }
        }

        // If conflicts found, throw a single error with all conflicts
        if (conflicts.length > 0) {
            const conflictList = conflicts.join(', ');
            throw new BadRequestError(`${conflictList} provided ${conflicts.length > 1 ? 'are' : 'is'} already in use`);
        }

        return true;
    }

    static async isWalletAddressAvailable(walletAddress: string): Promise<boolean> {
        const existingUser: User | null = await User.findOne({
            where: { walletAddress },
            attributes: ['walletAddress'],
        });

        if (existingUser) {
            throw new BadRequestError('Wallet address already in use');
        }

        return true;
    }

    static async addUser(userData: IUser): Promise<User> {

        const _transaction = await User.create({ ...userData });

        await UserSettings.create({
            userId: _transaction.id,
            joinDate: new Date().toISOString().split('T')[0], // yyyy-mm-dd format
        } as IUserSettings);

        return _transaction;
    }

    static async viewUsers(queryData?: IViewUsersQuery): Promise<{ users: User[], count: number, totalPages?: number }> {
        const { page, size, q: query, isBlocked, isDeactivated } = queryData || {};

        const where: Record<string | symbol, unknown> = {};
        const settingsWhere: Record<string, unknown> = {};

        if (query) {
            where[Op.or] = [
                { firstName: { [Op.iLike]: `%${query}%` } },
                { lastName: { [Op.iLike]: `%${query}%` } },
                { username: { [Op.iLike]: `%${query}%` } },
                { email: { [Op.iLike]: `%${query}%` } },
                Sequelize.where(Sequelize.fn('concat', Sequelize.col('User.firstName'), ' ', Sequelize.col('User.lastName')), { [Op.iLike]: `%${query}%` }),
            ];
        }

        if (isBlocked !== undefined) {
            settingsWhere.isBlocked = isBlocked;
        }

        if (isDeactivated !== undefined) {
            settingsWhere.isDeactivated = isDeactivated;
        }

        const queryOptions: FindAndCountOptions<User> = {
            where,
            include: [
                {
                    model: UserSettings,
                    as: 'settings',
                    attributes: ['joinDate', 'isBlocked', 'isDeactivated', 'lastLogin', 'meta'],
                    where: settingsWhere,
                },
            ],
        };

        if (page && size && page > 0 && size > 0) {
            const { limit, offset } = Pagination.getPagination({ page, size } as IPaging);
            queryOptions.limit = limit || 0;
            queryOptions.offset = offset || 0;
        }

        const { rows: users, count } = await User.findAndCountAll(queryOptions);

        // Calculate the total count
        const totalCount = (count as unknown as []).length;

        if (page && size && users.length > 0) {
            const totalPages = Pagination.estimateTotalPage({ count: totalCount, limit: size } as IPaging);
            return { users, count: totalCount, ...totalPages };
        } else {
            return { users, count: totalCount };
        }
    }

    static async viewSingleUser(id: string): Promise<User> {
        const user: User | null = await User.scope('withSettings').findByPk(id);

        if (!user) {
            throw new NotFoundError('Oops User not found');
        }

        return user;
    }

    static async viewSingleUserByWalletAddress(walletAddress: string, transaction?: Transaction): Promise<User> {
        const user: User | null = await User.scope('withSettings').findOne({
            where: { walletAddress },
            transaction,
        });

        if (!user) {
            throw new NotFoundError('Oops User not found');
        }

        return user;
    }

    static async viewSingleUserByEmail(email: string, transaction?: Transaction): Promise<User> {
        const user: User | null = await User.findOne({
            where: { email },
            attributes: ['id', 'firstName', 'status'],
            transaction,
        });

        if (!user) {
            throw new NotFoundError('Oops User not found');
        }

        return user;
    }

    static async viewSingleUserDynamic(queryOptions: IDynamicQueryOptions): Promise<User> {
        const { query, attributes } = queryOptions;

        const user: User | null = await User.scope('withSettings').findOne({
            where: query,
            ...(attributes ? { attributes } : {}),
        });

        if (!user) {
            throw new NotFoundError('Oops User not found');
        }

        return user;
    }

    static async updateUser(user: User, dataToUpdate: Partial<IUser>): Promise<User> {
        await user.update(dataToUpdate);

        const updatedUser = await this.viewSingleUser(user.id);

        return updatedUser;
    }

    static async updateUserSettings(userId: string, dataToUpdate: Partial<IUserSettings>): Promise<UserSettings> {
        const userSettings = await UserSettings.findOne({ where: { userId } });
        if (!userSettings) {
            throw new NotFoundError('Oops User not found');
        }

        await userSettings.update(dataToUpdate);

        return userSettings;
    }

    static async deleteUser(user: User, transaction?: Transaction): Promise<void> {
        transaction ? await user.destroy({ transaction }) : await user.destroy();
    }

    
    static async addWithdrawalRequest(requestData: IWithdrawalRequest, transaction?: Transaction): Promise<WithdrawalRequest> {
        const newRequest = await WithdrawalRequest.create({ ...requestData }, { transaction });
        return newRequest;
    }

    static async updateWithdrawalRequest(request: WithdrawalRequest, dataToUpdate: Partial<IWithdrawalRequest>): Promise<WithdrawalRequest> {
        await request.update(dataToUpdate);
        const updatedRequest = await this.viewWithdrawalRequest(request.id);
        return updatedRequest;
    }

    static async deleteWithdrawalRequest(request: WithdrawalRequest, transaction?: Transaction): Promise<void> {
        transaction ? await request.destroy({ transaction }) : await request.destroy();
    }

    static async viewWithdrawalRequest(id: string): Promise<WithdrawalRequest> {
        const include: Includeable[] = [
            {
                model: User,
                attributes: ['id', 'name', 'email'],
            },
        ];

        const request: WithdrawalRequest | null = await WithdrawalRequest.findByPk(id, { include });

        if (!request) {
            throw new NotFoundError('Withdrawal request not found');
        }

        return request;
    }

    static async viewWithdrawalRequests(queryData?: IViewWithdrawalRequestsQuery): Promise<{ requests: WithdrawalRequest[], count?: number, totalPages?: number }> {
        let conditions: Record<string, unknown> = {};
        let paginate = false;
        const { page, size, userId, status, minAmount, maxAmount } = queryData as IViewWithdrawalRequestsQuery;

        if (page && size && page > 0 && size > 0) {
            const { limit, offset } = Pagination.getPagination({ page, size } as IPaging);
            conditions = { limit, offset };
            paginate = true;
        }

        const where: WhereOptions = {};

        if (userId) {
            where.userId = userId;
        }

        if (status) {
            where.status = status;
        }

        if (minAmount !== undefined || maxAmount !== undefined) {
            where.amount = {};
            if (minAmount !== undefined) where.amount[Op.gte] = minAmount;
            if (maxAmount !== undefined) where.amount[Op.lte] = maxAmount;
        }

        const { rows: requests, count }: { rows: WithdrawalRequest[], count: number } = await WithdrawalRequest.findAndCountAll({
            ...conditions,
            where,
            order: [['requestDate', 'DESC']],
            include: [
                {
                    model: User,
                    attributes: ['id', 'name', 'email'],
                },
            ],
        });

        if (paginate && requests.length > 0) {
            const totalPages = Pagination.estimateTotalPage({ count, limit: size } as IPaging);
            return { requests, count, ...totalPages };
        } else return { requests };
    }

    static async validateWithdrawalRequestData(data: Partial<IWithdrawalRequest>): Promise<Partial<IWithdrawalRequest>> {
        const { userId, amount, requestDate, description, status } = data;

        const missingFields = [];

        if (!userId) missingFields.push('userId');
        if (!amount) missingFields.push('amount');
        if (!requestDate) missingFields.push('requestDate');
        if (!description) missingFields.push('description');
        if (!status) missingFields.push('status');

        if (missingFields.length > 0) {
            throw new BadRequestError(`Missing or invalid fields: ${missingFields.join(', ')}`);
        }

        if (!Object.values(WithdrawalStatus).includes(status as WithdrawalStatus)) {
            throw new BadRequestError('Invalid withdrawal status');
        }

        if (amount === undefined || amount <= 0) {
            throw new BadRequestError('Amount must be greater than 0');
        }

        return data;
    }
}