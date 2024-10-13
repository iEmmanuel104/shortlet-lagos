import { Request, Response } from 'express';
import VerificationService, { IViewVerificationDocsQuery } from '../services/verification.service';
import { BadRequestError } from '../utils/customErrors';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { DocType, IVerificationDoc, VerificationStatus } from '../models/verificationDocs.model';

export default class VerificationController {

    static async getAllVerificationDocs(req: Request, res: Response) {
        const { page, size, userId, type, status } = req.query;

        const queryParams: IViewVerificationDocsQuery = {
            ...(page && size ? { page: Number(page), size: Number(size) } : {}),
            ...(userId && { userId: userId as string }),
            ...(type && { type: type as DocType }),
            ...(status && { status: status as VerificationStatus }),
        };

        const docs = await VerificationService.viewVerificationDocs(queryParams);
        res.status(200).json({
            status: 'success',
            message: 'Verification documents retrieved successfully',
            data: { ...docs },
        });
    }

    static async getVerificationDocById(req: Request, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Verification document ID is required');
        }

        const doc = await VerificationService.viewVerificationDoc(id);
        res.status(200).json({
            status: 'success',
            message: 'Verification document retrieved successfully',
            data: doc,
        });
    }

    static async addVerificationDoc(req: AuthenticatedRequest, res: Response) {
        const validatedData = await VerificationService.validateVerificationDocData(req.body);

        const newDoc = await VerificationService.addVerificationDoc(validatedData as IVerificationDoc);
        res.status(201).json({
            status: 'success',
            message: 'Verification document added successfully',
            data: newDoc,
        });
    }

    static async updateVerificationDoc(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Verification document ID is required');
        }

        const doc = await VerificationService.viewVerificationDoc(id);
        const validatedData = await VerificationService.validateVerificationDocData(req.body);

        const updatedDoc = await VerificationService.updateVerificationDoc(doc, validatedData);
        res.status(200).json({
            status: 'success',
            message: 'Verification document updated successfully',
            data: updatedDoc,
        });
    }

    static async deleteVerificationDoc(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Verification document ID is required');
        }

        const doc = await VerificationService.viewVerificationDoc(id);
        await VerificationService.deleteVerificationDoc(doc);
        res.status(200).json({
            status: 'success',
            message: 'Verification document deleted successfully',
            data: null,
        });
    }

}
