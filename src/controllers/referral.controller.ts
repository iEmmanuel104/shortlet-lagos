import { Request, Response } from 'express';
import ReferralService, { IViewReferralsQuery } from '../services/referral.service';
import { BadRequestError } from '../utils/customErrors';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { IReferral, ReferralStatus } from '../models/referral.model';

export default class ReferralController {

    static async getAllReferrals(req: Request, res: Response) {
        const { page, size, refereeId, referredId, status } = req.query;

        const queryParams: IViewReferralsQuery = {
            ...(page && size ? { page: Number(page), size: Number(size) } : {}),
            ...(refereeId && { refereeId: refereeId as string }),
            ...(referredId && { referredId: referredId as string }),
            ...(status && { status: status as ReferralStatus }),
        };

        const referrals = await ReferralService.viewReferrals(queryParams);
        res.status(200).json({
            status: 'success',
            message: 'Referrals retrieved successfully',
            data: { ...referrals },
        });
    }

    static async getReferralById(req: Request, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Referral ID is required');
        }

        const referral = await ReferralService.viewReferral(id);
        res.status(200).json({
            status: 'success',
            message: 'Referral retrieved successfully',
            data: referral,
        });
    }

    static async createReferral(req: AuthenticatedRequest, res: Response) {
        const validatedData = await ReferralService.validateReferralData(req.body);

        const newReferral = await ReferralService.createReferral(validatedData as IReferral);
        res.status(201).json({
            status: 'success',
            message: 'Referral created successfully',
            data: newReferral,
        });
    }

    static async updateReferral(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Referral ID is required');
        }

        const referral = await ReferralService.viewReferral(id);
        const validatedData = await ReferralService.validateReferralData(req.body);

        const updatedReferral = await ReferralService.updateReferral(referral, validatedData);
        res.status(200).json({
            status: 'success',
            message: 'Referral updated successfully',
            data: updatedReferral,
        });
    }

    static async deleteReferral(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Referral ID is required');
        }

        const referral = await ReferralService.viewReferral(id);
        await ReferralService.deleteReferral(referral);
        res.status(200).json({
            status: 'success',
            message: 'Referral deleted successfully',
            data: null,
        });
    }

    static async getUserReferrals(req: AuthenticatedRequest, res: Response) {
        const userId = req.user.id;
        const { role } = req.query;

        if (!role || (role !== 'referee' && role !== 'referred')) {
            throw new BadRequestError('Valid role (referee or referred) is required');
        }

        const referrals = await ReferralService.getUserReferrals(userId, role);
        res.status(200).json({
            status: 'success',
            message: `User's ${role} referrals retrieved successfully`,
            data: referrals,
        });
    }
}
