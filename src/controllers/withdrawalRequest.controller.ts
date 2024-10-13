import { Request, Response } from 'express';
import WithdrawalRequestService, { IViewWithdrawalRequestsQuery } from '../services/user.service';
import { BadRequestError } from '../utils/customErrors';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { IWithdrawalRequest, WithdrawalStatus } from '../models/withdrawalRequest.model';

export default class WithdrawalRequestController {

    static async getAllWithdrawalRequests(req: Request, res: Response) {
        const { page, size, userId, status, minAmount, maxAmount } = req.query;

        const queryParams: IViewWithdrawalRequestsQuery = {
            ...(page && size ? { page: Number(page), size: Number(size) } : {}),
            ...(userId && { userId: userId as string }),
            ...(status && { status: status as WithdrawalStatus }),
            ...(minAmount && { minAmount: Number(minAmount) }),
            ...(maxAmount && { maxAmount: Number(maxAmount) }),
        };

        const requests = await WithdrawalRequestService.viewWithdrawalRequests(queryParams);
        res.status(200).json({
            status: 'success',
            message: 'Withdrawal requests retrieved successfully',
            data: { ...requests },
        });
    }

    static async getWithdrawalRequestById(req: Request, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Withdrawal request ID is required');
        }

        const request = await WithdrawalRequestService.viewWithdrawalRequest(id);
        res.status(200).json({
            status: 'success',
            message: 'Withdrawal request retrieved successfully',
            data: request,
        });
    }

    static async addWithdrawalRequest(req: AuthenticatedRequest, res: Response) {
        const validatedData = await WithdrawalRequestService.validateWithdrawalRequestData(req.body);

        const newRequest = await WithdrawalRequestService.addWithdrawalRequest(validatedData as IWithdrawalRequest);
        res.status(201).json({
            status: 'success',
            message: 'Withdrawal request added successfully',
            data: newRequest,
        });
    }

    static async updateWithdrawalRequest(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Withdrawal request ID is required');
        }

        const request = await WithdrawalRequestService.viewWithdrawalRequest(id);
        const validatedData = await WithdrawalRequestService.validateWithdrawalRequestData(req.body);

        const updatedRequest = await WithdrawalRequestService.updateWithdrawalRequest(request, validatedData);
        res.status(200).json({
            status: 'success',
            message: 'Withdrawal request updated successfully',
            data: updatedRequest,
        });
    }

    static async deleteWithdrawalRequest(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Withdrawal request ID is required');
        }

        const request = await WithdrawalRequestService.viewWithdrawalRequest(id);
        await WithdrawalRequestService.deleteWithdrawalRequest(request);
        res.status(200).json({
            status: 'success',
            message: 'Withdrawal request deleted successfully',
            data: null,
        });
    }

    static async getWithdrawalRequestsByUser(req: Request, res: Response) {
        const { userId } = req.params;
        const { page, size, status, minAmount, maxAmount } = req.query;

        if (!userId) {
            throw new BadRequestError('User ID is required');
        }

        const queryParams: IViewWithdrawalRequestsQuery = {
            ...(page && size ? { page: Number(page), size: Number(size) } : {}),
            userId,
            ...(status && { status: status as WithdrawalStatus }),
            ...(minAmount && { minAmount: Number(minAmount) }),
            ...(maxAmount && { maxAmount: Number(maxAmount) }),
        };

        const requests = await WithdrawalRequestService.viewWithdrawalRequests(queryParams);
        res.status(200).json({
            status: 'success',
            message: 'Withdrawal requests for user retrieved successfully',
            data: { ...requests },
        });
    }

    static async approveWithdrawalRequest(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Withdrawal request ID is required');
        }

        const request = await WithdrawalRequestService.viewWithdrawalRequest(id);
        const updatedRequest = await WithdrawalRequestService.updateWithdrawalRequest(request, { status: WithdrawalStatus.Approved });

        res.status(200).json({
            status: 'success',
            message: 'Withdrawal request approved successfully',
            data: updatedRequest,
        });
    }

    static async rejectWithdrawalRequest(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Withdrawal request ID is required');
        }

        const request = await WithdrawalRequestService.viewWithdrawalRequest(id);
        const updatedRequest = await WithdrawalRequestService.updateWithdrawalRequest(request, { status: WithdrawalStatus.Rejected });

        res.status(200).json({
            status: 'success',
            message: 'Withdrawal request rejected successfully',
            data: updatedRequest,
        });
    }
}
