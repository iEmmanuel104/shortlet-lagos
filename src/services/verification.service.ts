import { Transaction, Includeable, WhereOptions } from 'sequelize';
import User from '../models/user.model';
import { NotFoundError, BadRequestError } from '../utils/customErrors';
import Pagination, { IPaging } from '../utils/pagination';
import VerificationDoc, { DocType, IVerificationDoc, VerificationStatus } from '../models/verificationDocs.model';


export interface IViewVerificationDocsQuery {
    page?: number;
    size?: number;
    userId?: string;
    type?: DocType;
    status?: VerificationStatus;
}

export default class VerificationService {

    static async addVerificationDoc(docData: IVerificationDoc, transaction?: Transaction): Promise<VerificationDoc> {
        const newDoc = await VerificationDoc.create({ ...docData }, { transaction });
        return newDoc;
    }

    static async updateVerificationDoc(doc: VerificationDoc, dataToUpdate: Partial<IVerificationDoc>): Promise<VerificationDoc> {
        await doc.update(dataToUpdate);
        const updatedDoc = await this.viewVerificationDoc(doc.id);
        return updatedDoc;
    }

    static async deleteVerificationDoc(doc: VerificationDoc, transaction?: Transaction): Promise<void> {
        transaction ? await doc.destroy({ transaction }) : await doc.destroy();
    }

    static async viewVerificationDoc(id: string): Promise<VerificationDoc> {
        const include: Includeable[] = [
            {
                model: User,
                attributes: ['id', 'username', 'email'],
            },
        ];

        const doc: VerificationDoc | null = await VerificationDoc.findByPk(id, { include });

        if (!doc) {
            throw new NotFoundError('Verification document not found');
        }

        return doc;
    }

    static async viewVerificationDocs(queryData?: IViewVerificationDocsQuery): Promise<{ docs: VerificationDoc[], count?: number, totalPages?: number }> {
        let conditions: Record<string, unknown> = {};
        let paginate = false;
        const { page, size, userId, type, status } = queryData as IViewVerificationDocsQuery;

        if (page && size && page > 0 && size > 0) {
            const { limit, offset } = Pagination.getPagination({ page, size } as IPaging);
            conditions = { limit, offset };
            paginate = true;
        }

        const where: WhereOptions = {};

        if (userId) {
            where.userId = userId;
        }

        if (type) {
            where.type = type;
        }

        if (status) {
            where.status = status;
        }

        const { rows: docs, count }: { rows: VerificationDoc[], count: number } = await VerificationDoc.findAndCountAll({
            ...conditions,
            where,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: User,
                    attributes: ['id', 'username', 'email'],
                },
            ],
        });

        if (paginate && docs.length > 0) {
            const totalPages = Pagination.estimateTotalPage({ count, limit: size } as IPaging);
            return { docs, count, ...totalPages };
        } else return { docs };
    }

    static async validateVerificationDocData(data: Partial<IVerificationDoc>): Promise<Partial<IVerificationDoc>> {
        const { userId, type, status, url } = data;

        const missingFields = [];

        if (!userId) missingFields.push('userId');
        if (!type) missingFields.push('type');
        if (!status) missingFields.push('status');
        if (!url) missingFields.push('url');

        if (missingFields.length > 0) {
            throw new BadRequestError(`Missing or invalid fields: ${missingFields.join(', ')}`);
        }

        if (!Object.values(DocType).includes(type as DocType)) {
            throw new BadRequestError('Invalid document type');
        }

        if (!Object.values(VerificationStatus).includes(status as VerificationStatus)) {
            throw new BadRequestError('Invalid verification status');
        }

        return data;
    }

}