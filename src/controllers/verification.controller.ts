/* eslint-disable no-undef */
import { Request, Response } from 'express';
import VerificationService, { IViewVerificationDocsQuery } from '../services/verification.service';
import { BadRequestError } from '../utils/customErrors';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { DocumentProofType, DocumentSection, VerificationStatus } from '../models/verificationDocs.model';
import CloudinaryClientConfig from '../clients/cloudinary.config';

export default class VerificationController {

    static async addOrUpdateVerificationDocs(req: AuthenticatedRequest, res: Response) {
        const user = req.user;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const { section, documentType } = req.body;

        if (!section || !documentType) {
            throw new BadRequestError('Invalid section or document type');
        }

        if (!files || Object.keys(files).length === 0) {
            throw new BadRequestError('At least one file is required');
        }

        // Handle all uploaded files in a single request
        const uploadedUrls = await VerificationController.handleFileUploads(
            files,
            user.id
        );

        // Add or update verification docs
        const doc = await VerificationService.addOrUpdateVerificationDoc(
            user.id,
            section,
            uploadedUrls,
            documentType as DocumentProofType
        );

        res.status(200).json({
            status: 'success',
            message: 'Documents uploaded successfully',
            data: doc,
        });
    }

    private static async handleFileUploads(
        files: { [fieldname: string]: Express.Multer.File[] },
        userId: string
    ): Promise<string[]> {
        const uploadedUrls: string[] = [];
        const uploadPromises = [];

        // Handle front identity document
        if (files.front?.[0]) {
            uploadPromises.push(
                this.uploadFile(files.front[0], userId, 'identity_front')
                    .then(url => uploadedUrls.push(url))
            );
        }

        // Handle back identity document
        if (files.back?.[0]) {
            uploadPromises.push(
                this.uploadFile(files.back[0], userId, 'identity_back')
                    .then(url => uploadedUrls.push(url))
            );
        }

        // Handle address document
        if (files.document?.[0]) {
            uploadPromises.push(
                this.uploadFile(files.document[0], userId, 'address')
                    .then(url => uploadedUrls.push(url))
            );
        }

        // Handle selfie
        if (files.selfie?.[0]) {
            uploadPromises.push(
                this.uploadFile(files.selfie[0], userId, 'selfie')
                    .then(url => uploadedUrls.push(url))
            );
        }

        // Wait for all uploads to complete
        await Promise.all(uploadPromises);

        return uploadedUrls;
    }

    private static async uploadFile(
        file: Express.Multer.File,
        userId: string,
        type: string
    ): Promise<string> {
        const result = await CloudinaryClientConfig.uploadtoCloudinary({
            fileBuffer: file.buffer,
            id: `${userId}_${type}_${Date.now()}`,
            name: file.originalname,
            type: type.includes('document') ? 'document' : 'image',
        });

        return result.url as string;
    }

    static async getAllVerificationDocs(req: Request, res: Response) {
        const { page, size, userId, status } = req.query;

        const queryParams: IViewVerificationDocsQuery = {
            ...(page && size ? { page: Number(page), size: Number(size) } : {}),
            ...(userId && { userId: userId as string }),
            ...(status && { status: status as VerificationStatus }),
        };

        const docs = await VerificationService.viewVerificationDocs(queryParams);
        res.status(200).json({
            status: 'success',
            message: 'Verification documents retrieved successfully',
            data: { ...docs },
        });
    }

    static async submitForVerification(req: AuthenticatedRequest, res: Response) {
        const userId = req.user.id;

        const doc = await VerificationService.submitForVerification(userId);

        res.status(200).json({
            status: 'success',
            message: 'Documents submitted for verification successfully',
            data: doc,
        });

    }

    static async updateDocumentStatus(req: AuthenticatedRequest, res: Response) {
        const { userId } = req.params;
        const { section, documentType, status, rejectionReason } = req.body;

        // Validate input
        if (!section || !documentType || !status || !Object.values(DocumentSection).includes(section)) {
            throw new BadRequestError('Invalid request parameters');
        }

        const doc = await VerificationService.updateDocumentStatus(
            userId,
                section as DocumentSection,
                documentType as DocumentProofType,
                status as VerificationStatus,
                rejectionReason
        );

        res.status(200).json({
            status: 'success',
            message: 'Document status updated successfully',
            data: doc,
        });

    }

    static async getVerificationDocsByUser(req: AuthenticatedRequest, res: Response) {
        const userId = req.user.id;

        const doc = await VerificationService.viewUserVerificationDoc(userId);

        res.status(200).json({
            status: 'success',
            message: 'Verification documents retrieved successfully',
            data: doc,
        });

    }

}
