import { Transaction, Op, Includeable, WhereOptions } from 'sequelize';
import User from '../models/user.model';
import { NotFoundError, BadRequestError } from '../utils/customErrors';
import Pagination, { IPaging } from '../utils/pagination';
import WithdrawalRequest, { IWithdrawalRequest, WithdrawalStatus } from '../models/withdrawalRequest.model';

export interface IViewWithdrawalRequestsQuery {
    page?: number;
    size?: number;
    userId?: string;
    status?: WithdrawalStatus;
    minAmount?: number;
    maxAmount?: number;
}

export default class WithdrawalRequestService {

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