import { Response, Request } from 'express';
import UserService from '../services/user.service';
import { BadRequestError } from '../utils/customErrors';
import { AdminAuthenticatedRequest, AuthenticatedRequest } from '../middlewares/authMiddleware';
import CloudinaryClientConfig from '../clients/cloudinary.config';
import Validator from '../utils/validators';
import { logger } from '../utils/logger';
import { Transaction } from 'sequelize';
import { Database } from '../models';
import { TicketType, ISupportTicket } from '../models/supportTicket.model';
// import { emailService } from '../utils/Email';
import AdminService from '../services/AdminServices/admin.service';
import { UserType } from '../models/user.model';

export default class UserController {

    static async getAllUsers(req: Request, res: Response) {
        const { page, size, q, isBlocked, isDeactivated, type } = req.query;
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

        if (type && Object.values(UserType).includes(type as UserType)) {
            queryParams.type = type as UserType;
        }

        const users = await UserService.viewUsers(queryParams);
        res.status(200).json({
            status: 'success',
            message: 'Users retrieved successfully',
            data: { ...users },
        });
    }

    static async getUser(req: Request, res: Response) {
        const { id } = req.query;

        // Check if request is from an admin
        const isAdmin = (req as AdminAuthenticatedRequest).admin !== undefined;
        console.log({ isAdmin });
        const user = await UserService.viewSingleUser(id as string, isAdmin);

        res.status(200).json({
            status: 'success',
            message: 'User retrieved successfully',
            data: user,
        });

    }

    static async updateUser(req: AuthenticatedRequest, res: Response) {
        const { email, firstName, lastName, otherName, displayImage, gender, isDeactivated } = req.body;

        if (email && !Validator.isValidEmail(email)) {
            throw new BadRequestError('Invalid email');
        }
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
            ...(email && { email }),
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

    static async createSupportTicket(req: Request, res: Response) {
        const { email, name, message, subject, type } = req.body;

        const missingFields = [];
        if (!email) missingFields.push('email');
        if (!message) missingFields.push('message');
        if (!subject) missingFields.push('subject');
        if (!type) missingFields.push('type');
        if (!name) missingFields.push('name');

        if (missingFields.length > 0) {
            throw new BadRequestError(`Please provide ${missingFields.join(', ')}`);
        }

        const validEmail = Validator.isValidEmail(email);
        if (!validEmail) {
            throw new BadRequestError('Invalid email format');
        }

        // check if type is support or bug report
        const validType = type === TicketType.SupportRequest || type === TicketType.BugReport;
        if (!validType) {
            throw new BadRequestError('Invalid type');
        }

        const templateData = {
            email,
            name,
            message,
            subject,
            type,
        };

        // send email to support
        // await emailService.send({
        //     email: 'batch',
        //     subject: type,
        //     from: 'support',
        //     isPostmarkTemplate: true,
        //     postMarkTemplateAlias: 'support-email',
        //     postmarkInfo: [{
        //         postMarkTemplateData: templateData,
        //         receipientEmail: 'help@blkat.io',
        //     }],
        // });

        await Database.transaction(async (transaction: Transaction) => {
            // check if email exists
            const userExists = (req as AuthenticatedRequest) && (req as AuthenticatedRequest).user;
            let userId = null;
            if (userExists && userExists.id) {
                userId = userExists.id;
                (templateData as ISupportTicket).userId = userId;
            }

            const ticket = await AdminService.createTicket(templateData as ISupportTicket, transaction);
            logger.info('ticket created', ticket);

            res.status(200).json({
                status: 'success',
                message: `${type} sent successfully`,
                data: null,
            });
        });
    }

}
