import { Transaction, Op, FindAndCountOptions } from 'sequelize';
import User, { IUser, UserType } from '../models/user.model';
import { NotFoundError, BadRequestError } from '../utils/customErrors';
import Validator from '../utils/validators';
import Pagination, { IPaging } from '../utils/pagination';
import { Sequelize } from '../models';
import UserSettings, { IUserSettings } from '../models/userSettings.model';
import HelperUtils from '../utils/helpers';

export interface IViewUsersQuery {
    page?: number;
    size?: number;
    q?: string;
    isBlocked?: boolean;
    isDeactivated?: boolean;
    type?: UserType;
}

export interface IDynamicQueryOptions {
    query: Record<string, string>;
    includes?: 'profile' | 'all';
    attributes?: string[];
}
interface WhereCondition {
    email?: string;
    walletAddress?: string;
    username?: string;
}

export default class UserService {


    static async isWalletAddressEmailAndUserNameAvailable(walletAddress: string, username: string, email?: string): Promise<boolean> {
        // Validate email if provided
        if (email && !Validator.isValidEmail(email)) {
            throw new BadRequestError('Invalid email');
        }

        // Construct where condition based on provided parameters
        const orConditions: WhereCondition[] = [
            { walletAddress },
            { username },
        ];

        // Only add email condition if email is provided
        if (email) {
            orConditions.push({ email });
        }

        const whereCondition = {
            [Op.or]: orConditions,
        };

        // Find existing users with the given wallet address, username, and email (if provided)
        const existingUsers = await User.findAll({
            where: whereCondition,
            attributes: ['email', 'walletAddress', 'username'],
        });

        // Check for conflicts and collect them
        const conflicts: string[] = [];
        for (const user of existingUsers) {
            if (email && user.email === email) {
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
            const isPlural = conflicts.length > 1;
            throw new BadRequestError(`${conflictList} ${isPlural ? 'are' : 'is'} already in use`);
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
            referralDetails: {
                referralCode: HelperUtils.generateRandomString(6),
                referralBonus: 0,
            },
        } as IUserSettings);

        return _transaction;
    }

    static async viewUsers(queryData?: IViewUsersQuery): Promise<{ users: User[], count: number, totalPages?: number }> {
        const { page, size, q: query, isBlocked, isDeactivated, type } = queryData || {};

        const where: Record<string | symbol, unknown> = {};
        const settingsWhere: Record<string, unknown> = {};

        // Add search query conditions
        if (query) {
            where[Op.or] = [
                { firstName: { [Op.iLike]: `%${query}%` } },
                { lastName: { [Op.iLike]: `%${query}%` } },
                { username: { [Op.iLike]: `%${query}%` } },
                { email: { [Op.iLike]: `%${query}%` } },
                Sequelize.where(
                    Sequelize.fn('concat',
                        Sequelize.col('User.firstName'),
                        ' ',
                        Sequelize.col('User.lastName')
                    ),
                    { [Op.iLike]: `%${query}%` }
                ),
            ];
        }

        if (type && Object.values(UserType).includes(type)) {
            where.type = type;
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
            order: [['createdAt', 'DESC']],
        };

        // Add pagination if provided
        if (page && size && page > 0 && size > 0) {
            const { limit, offset } = Pagination.getPagination({ page, size } as IPaging);
            queryOptions.limit = limit || 0;
            queryOptions.offset = offset || 0;
        }

        const { rows: users, count } = await User.findAndCountAll(queryOptions);

        // Calculate the total count
        const totalCount = (count as unknown as []).length;

        // Return with pagination info if pagination was requested
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

    static async viewSingleUserByWalletAddress(walletAddress: string, transaction?: Transaction): Promise<User | null> {
        console.log({ walletAddress });
        const user: User | null = await User.findOne({
            where: { walletAddress },
            include: [
                {
                    model: UserSettings,
                    as: 'settings',
                    attributes: ['joinDate', 'isBlocked', 'isDeactivated', 'lastLogin', 'meta'],
                },
            ],
            transaction,
        });
        console.log({ user });

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

    static async viewSingleUserByUsername(username: string, transaction?: Transaction): Promise<User | null> {
        const user: User | null = await User.findOne({
            where: { username },
            attributes: ['id'],
            transaction,
        });

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

}