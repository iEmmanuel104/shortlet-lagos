import { Request, Response } from 'express';
import UserService, { IViewWithdrawalRequestsQuery } from '../services/user.service';
import { BadRequestError } from '../utils/customErrors';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import CloudinaryClientConfig from '../clients/cloudinary.config';
import { IWithdrawalRequest, WithdrawalStatus } from '../models/withdrawalRequest.model';

export default class UserController {

    static async getAllUsers(req: AuthenticatedRequest, res: Response) {
        const { page, size, q, isBlocked, isDeactivated } = req.query;
        const queryParams: Record<string, unknown> = {};

        if (page && size) {
            queryParams.page = Number(page);
            queryParams.size = Number(size);
        }

        // Add filters for blocked and deactivated users
        if (isBlocked !== undefined) {
            queryParams.isBlocked = isBlocked === 'true';
        }

        if (isDeactivated !== undefined) {
            queryParams.isDeactivated = isDeactivated === 'true';
        }

        // Add search query if provided
        if (q) {
            queryParams.q = q as string;
        }

        const users = await UserService.viewUsers(queryParams);
        res.status(200).json({
            status: 'success',
            message: 'Users retrieved successfully',
            data: { ...users },
        });
    }

    static async getUser(req: AuthenticatedRequest, res: Response) {
        const { id } = req.query;

        const user = await UserService.viewSingleUser(id as string);

        res.status(200).json({
            status: 'success',
            message: 'User retrieved successfully',
            data: user,
        });
    }

    static async updateUser(req: AuthenticatedRequest, res: Response) {
        const { firstName, lastName, otherName, displayImage, gender, isDeactivated } = req.body;

        // eslint-disable-next-line no-undef
        const file = req.file as Express.Multer.File | undefined;
        let url;
        if (file) {
            const result = await CloudinaryClientConfig.uploadtoCloudinary({
                fileBuffer: file.buffer,
                id: req.user.id,
                name: file.originalname,
                type: 'image',
            });
            url = result.url as string;
        } else if (displayImage) {
            url = displayImage;
        }

        // Prepare the update data for the user profile
        const updateData = {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(otherName && { otherName }),
            ...(gender && { gender }),
            ...(url && { displayImage: url }),
        };

        // Only update settings if isDeactivated is provided in the request body
        let settingsData = {};
        if (isDeactivated !== undefined && isDeactivated === 'true') {
            const state: boolean = isDeactivated === 'true';
            settingsData = {
                ...(state === req.user.settings.isDeactivated ? {} : { isDeactivated: state }),
            };
        }

        const dataKeys = Object.keys(updateData);
        const settingsKeys = Object.keys(settingsData);

        if (dataKeys.length === 0 && settingsKeys.length === 0) {
            throw new BadRequestError('No new data to update');
        }

        // Update user settings if necessary
        if (settingsKeys.length > 0) {
            await UserService.updateUserSettings(req.user.id, settingsData);
        }

        // Update user profile data if necessary
        const updatedUser = dataKeys.length > 0
            ? await UserService.updateUser(req.user, updateData)
            : req.user;

        res.status(200).json({
            status: 'success',
            message: 'User updated successfully',
            data: updatedUser,
        });
    }


    static async getAllWithdrawalRequests(req: Request, res: Response) {
        const { page, size, userId, status, minAmount, maxAmount } = req.query;

        const queryParams: IViewWithdrawalRequestsQuery = {
            ...(page && size ? { page: Number(page), size: Number(size) } : {}),
            ...(userId && { userId: userId as string }),
            ...(status && { status: status as WithdrawalStatus }),
            ...(minAmount && { minAmount: Number(minAmount) }),
            ...(maxAmount && { maxAmount: Number(maxAmount) }),
        };

        const requests = await UserService.viewWithdrawalRequests(queryParams);
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

        const request = await UserService.viewWithdrawalRequest(id);
        res.status(200).json({
            status: 'success',
            message: 'Withdrawal request retrieved successfully',
            data: request,
        });
    }

    static async addWithdrawalRequest(req: AuthenticatedRequest, res: Response) {
        const validatedData = await UserService.validateWithdrawalRequestData(req.body);

        const newRequest = await UserService.addWithdrawalRequest(validatedData as IWithdrawalRequest);
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

        const request = await UserService.viewWithdrawalRequest(id);
        const validatedData = await UserService.validateWithdrawalRequestData(req.body);

        const updatedRequest = await UserService.updateWithdrawalRequest(request, validatedData);
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

        const request = await UserService.viewWithdrawalRequest(id);
        await UserService.deleteWithdrawalRequest(request);
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

        const requests = await UserService.viewWithdrawalRequests(queryParams);
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

        const request = await UserService.viewWithdrawalRequest(id);
        const updatedRequest = await UserService.updateWithdrawalRequest(request, { status: WithdrawalStatus.Approved });

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

        const request = await UserService.viewWithdrawalRequest(id);
        const updatedRequest = await UserService.updateWithdrawalRequest(request, { status: WithdrawalStatus.Rejected });

        res.status(200).json({
            status: 'success',
            message: 'Withdrawal request rejected successfully',
            data: updatedRequest,
        });
    }
}
