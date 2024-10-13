import { Transaction, Includeable, WhereOptions } from 'sequelize';
import User from '../models/user.model';
import { NotFoundError, BadRequestError } from '../utils/customErrors';
import Pagination, { IPaging } from '../utils/pagination';
import Referral, { IReferral, ReferralStatus } from '../models/referral.model';

export interface IViewReferralsQuery {
    page?: number;
    size?: number;
    refereeId?: string;
    referredId?: string;
    status?: ReferralStatus;
}

export default class ReferralService {

    static async createReferral(referralData: IReferral, transaction?: Transaction): Promise<Referral> {
        const newReferral = await Referral.create({ ...referralData }, { transaction });
        return newReferral;
    }

    static async updateReferral(referral: Referral, dataToUpdate: Partial<IReferral>): Promise<Referral> {
        await referral.update(dataToUpdate);
        const updatedReferral = await this.viewReferral(referral.id);
        return updatedReferral;
    }

    static async deleteReferral(referral: Referral, transaction?: Transaction): Promise<void> {
        transaction ? await referral.destroy({ transaction }) : await referral.destroy();
    }

    static async viewReferral(id: string): Promise<Referral> {
        const include: Includeable[] = [
            {
                model: User,
                as: 'referee',
                attributes: ['id', 'name', 'email'],
            },
            {
                model: User,
                as: 'referred',
                attributes: ['id', 'name', 'email'],
            },
        ];

        const referral: Referral | null = await Referral.findByPk(id, { include });

        if (!referral) {
            throw new NotFoundError('Referral not found');
        }

        return referral;
    }

    static async viewReferrals(queryData?: IViewReferralsQuery): Promise<{ referrals: Referral[], count?: number, totalPages?: number }> {
        let conditions: Record<string, unknown> = {};
        let paginate = false;
        const { page, size, refereeId, referredId, status } = queryData as IViewReferralsQuery;

        if (page && size && page > 0 && size > 0) {
            const { limit, offset } = Pagination.getPagination({ page, size } as IPaging);
            conditions = { limit, offset };
            paginate = true;
        }

        const where: WhereOptions = {};

        if (refereeId) {
            where.refereeId = refereeId;
        }

        if (referredId) {
            where.referredId = referredId;
        }

        if (status) {
            where.status = status;
        }

        const { rows: referrals, count }: { rows: Referral[], count: number } = await Referral.findAndCountAll({
            ...conditions,
            where,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'referee',
                    attributes: ['id', 'name', 'email'],
                },
                {
                    model: User,
                    as: 'referred',
                    attributes: ['id', 'name', 'email'],
                },
            ],
        });

        if (paginate && referrals.length > 0) {
            const totalPages = Pagination.estimateTotalPage({ count, limit: size } as IPaging);
            return { referrals, count, ...totalPages };
        } else return { referrals };
    }

    static async validateReferralData(data: Partial<IReferral>): Promise<Partial<IReferral>> {
        const { refereeId, referredId, status } = data;

        const missingFields = [];

        if (!refereeId) missingFields.push('refereeId');
        if (!referredId) missingFields.push('referredId');

        if (missingFields.length > 0) {
            throw new BadRequestError(`Missing or invalid fields: ${missingFields.join(', ')}`);
        }

        if (refereeId === referredId) {
            throw new BadRequestError('A user cannot refer themselves');
        }

        if (status && !Object.values(ReferralStatus).includes(status)) {
            throw new BadRequestError('Invalid referral status');
        }

        return data;
    }
}