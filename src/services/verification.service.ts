import { Includeable, WhereOptions } from 'sequelize';
import User from '../models/user.model';
import { NotFoundError, BadRequestError } from '../utils/customErrors';
import Pagination, { IPaging } from '../utils/pagination';
import VerificationDoc, {
    DocumentProofType,
    DocumentSection,
    VerificationStatus,
    DocumentData,
    IVerificationDoc,
} from '../models/verificationDocs.model';

interface DocumentValidationResult {
    isValid: boolean;
    message?: string;
}

interface VerificationDocuments {
    [DocumentSection.Identity]: DocumentData[];
    [DocumentSection.Address]: DocumentData[];
    [DocumentSection.Selfie]: DocumentData[];
}

export interface IViewVerificationDocsQuery {
    page?: number;
    size?: number;
    userId?: string;
    status?: VerificationStatus;
}

export default class VerificationService {
    static async addOrUpdateVerificationDoc(
        userId: string,
        section: DocumentSection,
        urls: string[],
        documentType: DocumentProofType,
    ): Promise<VerificationDoc> {
        if (!urls || urls.length === 0) {
            throw new BadRequestError('At least one document URL is required');
        }

        let doc = await VerificationDoc.findOne({
            where: { userId },
            include: [{
                model: User,
                attributes: ['id', 'username', 'email'],
            }],
        });

        if (!doc) {
            // Create new verification document with typed empty sections
            const initialDocuments: VerificationDocuments = {
                [DocumentSection.Identity]: [],
                [DocumentSection.Address]: [],
                [DocumentSection.Selfie]: [],
            };

            // Add the initial documents for the current section
            const formattedDocs = await this.formatDocumentsForSection(section, documentType, urls);
            initialDocuments[section] = formattedDocs;

            doc = await VerificationDoc.create({
                userId,
                status: VerificationStatus.Pending,
                documents: initialDocuments,
            } as IVerificationDoc);
        } else {
            if (doc.status === VerificationStatus.Submitted) {
                throw new BadRequestError('Cannot update documents after submission');
            }

            const documents = { ...doc.documents };

            // Remove existing documents of the same type if any
            if (documents[section]) {
                documents[section] = documents[section].filter(
                    doc => !doc.type.startsWith(documentType.split('_')[0])
                );
            }

            // Add new documents
            const newDocs = await this.formatDocumentsForSection(section, documentType, urls);
            documents[section] = [...documents[section], ...newDocs];

            // Reset document status to pending if it was previously rejected
            if (doc.status === VerificationStatus.Rejected) {
                doc.status = VerificationStatus.Pending;
            }

            await doc.update({ documents, status: doc.status });
        }

        return doc;
    }

    private static async formatDocumentsForSection(
        section: DocumentSection,
        documentType: DocumentProofType,
        urls: string[]
    ): Promise<DocumentData[]> {
        const documents: DocumentData[] = [];

        switch (section) {
        case DocumentSection.Identity:
            if (documentType.includes('passport')) {
                if (urls[0]) {
                    documents.push({
                        type: DocumentProofType.PassportFront,
                        url: urls[0],
                        status: VerificationStatus.Pending,
                    });
                }
            } else {
                // Handle front document
                if (urls[0]) {
                    documents.push({
                        type: documentType as DocumentProofType,
                        url: urls[0],
                        status: VerificationStatus.Pending,
                    });
                }
                // Handle back document if provided
                if (urls[1]) {
                    documents.push({
                        type: documentType as DocumentProofType,
                        url: urls[1],
                        status: VerificationStatus.Pending,
                    });
                }
            }
            break;

        case DocumentSection.Address:
        case DocumentSection.Selfie:
            if (urls[0]) {
                documents.push({
                    type: documentType,
                    url: urls[0],
                    status: VerificationStatus.Pending,
                });
            }
            break;
        }

        return documents;
    }

    static async submitForVerification(userId: string): Promise<VerificationDoc> {
        const doc = await this.viewUserVerificationDoc(userId);


        if (!doc) {
            throw new NotFoundError('Verification document not found');
        }

        if (doc.status === VerificationStatus.Submitted) {
            throw new BadRequestError('Documents are already submitted for verification');
        }

        // Check if all required documents are present and valid
        const { isValid, message } = this.validateAllDocuments(doc.documents);
        if (!isValid) {
            throw new BadRequestError(message || 'Missing or invalid documents');
        }

        // Update status to submitted
        await doc.update({ status: VerificationStatus.Submitted });
        return doc;
    }

    private static validateAllDocuments(documents: VerificationDocuments): DocumentValidationResult {
        // Check identity documents
        const identityDocs = documents[DocumentSection.Identity];
        const hasValidIdentity = this.validateIdentityDocuments(identityDocs);
        if (!hasValidIdentity) {
            return {
                isValid: false,
                message: 'Missing or invalid identity documents. Required: passport or both sides of driver\'s license/national ID',
            };
        }

        // Check address documents
        const addressDocs = documents[DocumentSection.Address];
        const hasValidAddress = this.validateAddressDocuments(addressDocs);
        if (!hasValidAddress) {
            return {
                isValid: false,
                message: 'Missing address proof document',
            };
        }

        // Check selfie
        const selfieDocs = documents[DocumentSection.Selfie];
        const hasValidSelfie = this.validateSelfieDocument(selfieDocs);
        if (!hasValidSelfie) {
            return {
                isValid: false,
                message: 'Missing selfie document',
            };
        }

        return { isValid: true };
    }

    private static validateIdentityDocuments(docs: DocumentData[]): boolean {
        if (!docs || docs.length === 0) return false;

        return (
            // Check for passport
            docs.some(d => d.type === DocumentProofType.PassportFront) ||
            // Check for driver's license (both front and back)
            (docs.some(d => d.type === DocumentProofType.DriverLicenseFront) &&
                docs.some(d => d.type === DocumentProofType.DriverLicenseBack)) ||
            // Check for national ID (both front and back)
            (docs.some(d => d.type === DocumentProofType.NationalIdFront) &&
                docs.some(d => d.type === DocumentProofType.NationalIdBack))
        );
    }

    private static validateAddressDocuments(docs: DocumentData[]): boolean {
        if (!docs || docs.length === 0) return false;

        return docs.some(d => [
            DocumentProofType.UtilityBill,
            DocumentProofType.BankStatement,
            DocumentProofType.RentProof,
        ].includes(d.type));
    }

    private static validateSelfieDocument(docs: DocumentData[]): boolean {
        if (!docs || docs.length === 0) return false;
        return docs.some(d => d.type === DocumentProofType.Selfie);
    }

    static async updateDocumentStatus(
        userId: string,
        section: DocumentSection,
        documentType: DocumentProofType,
        status: VerificationStatus,
        rejectionReason?: string
    ): Promise<VerificationDoc> {
        const doc = await this.viewUserVerificationDoc(userId);

        if (!doc) {
            throw new NotFoundError('Verification document not found');
        }

        const documents = doc.documents;
        const sectionDocs = documents[section];

        // Find the document(s) to update
        const docsToUpdate = sectionDocs.filter(d => {
            if (documentType.includes('_front') || documentType.includes('_back')) {
                const baseType = documentType.split('_')[0];
                return d.type.startsWith(baseType);
            }
            return d.type === documentType;
        });

        if (docsToUpdate.length === 0) {
            throw new NotFoundError(`Document of type ${documentType} not found`);
        }

        // Update status for all matching documents
        docsToUpdate.forEach(d => {
            d.status = status;
            if (rejectionReason) {
                d.rejectionReason = rejectionReason;
            }
        });

        // Update overall status
        const allDocuments = Object.values(documents).flat();

        if (allDocuments.every(d => d.status === VerificationStatus.Approved)) {
            doc.status = VerificationStatus.Approved;
        } else if (allDocuments.some(d => d.status === VerificationStatus.Rejected)) {
            doc.status = VerificationStatus.Rejected;
        }

        await doc.update({ documents, status: doc.status });
        return doc;
    }

    static async viewVerificationDocs(queryData?: IViewVerificationDocsQuery): Promise<{
        docs: VerificationDoc[],
        count?: number,
        totalPages?: number
    }> {
        let conditions: Record<string, unknown> = {};
        let paginate = false;
        const { page, size, userId, status } = queryData || {};

        if (page && size && page > 0 && size > 0) {
            const { limit, offset } = Pagination.getPagination({ page, size } as IPaging);
            conditions = { limit, offset };
            paginate = true;
        }

        const where: WhereOptions = {};

        if (userId) where.userId = userId;
        if (status) where.status = status;

        const { rows: docs, count } = await VerificationDoc.findAndCountAll({
            ...conditions,
            where,
            order: [['createdAt', 'DESC']],
            include: [{
                model: User,
                attributes: ['id', 'username', 'email'],
            }],
        });

        if (paginate && docs.length > 0) {
            const totalPages = Pagination.estimateTotalPage({ count, limit: size } as IPaging);
            return { docs, count, ...totalPages };
        }

        return { docs };
    }

    static async viewUserVerificationDoc(userId: string): Promise<VerificationDoc | null> {
        const include: Includeable[] = [
            {
                model: User,
                attributes: ['id', 'username', 'email'],
            },
        ];

        const doc: VerificationDoc | null = await VerificationDoc.findOne({
            where: { userId },
            include,
        });

        return doc;
    }

}