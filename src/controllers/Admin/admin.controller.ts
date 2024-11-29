import { Request, Response } from 'express';
import AdminService from '../../services/AdminServices/admin.service';
import { AdminAuthenticatedRequest } from '../../middlewares/authMiddleware';
import { BadRequestError, ForbiddenError, TokenExpiredError } from '../../utils/customErrors';
import { AuthUtil } from '../../utils/token';
import { emailService, EmailTemplate } from '../../utils/Email';
import UserService from '../../services/user.service';
import { ADMIN_EMAIL } from '../../utils/constants';
import InvestmentService from '../../services/investment.service';
import { TimePeriod } from '../../utils/interface';

export default class AdminController {

    static async loginSuperAdmin(req: Request, res: Response) {
        const { email } = req.body;

        let emailToUse = email.toLowerCase().trim();
        let firstName = 'Owner';
        if (email !== ADMIN_EMAIL) {
            const checkAdmin = await AdminService.getAdminByEmail(email);
            emailToUse = checkAdmin.email;
            firstName = checkAdmin.name.split(' ')[0];
        }

        // Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Generate token containing the OTP
        const otpToken = await AuthUtil.generateAdminOTPToken(emailToUse, otpCode);

        const templateData = {
            otpCode,
            name: firstName,
        };

        // Send email with OTP
        await emailService.send({
            email: emailToUse,
            from: 'auth',
            subject: 'Admin Login Verification',
            html: await new EmailTemplate().adminLogin({ otpCode, name: firstName }),
            isPostmarkTemplate: true,
            postMarkTemplateAlias: 'verify-email',
            postmarkInfo: [{
                postMarkTemplateData: templateData,
                receipientEmail: email,
            }],
        });

        res.status(200).json({
            status: 'success',
            message: 'Verification code sent to admin email',
            data: {
                otpToken, // Send this token back to be used in verification
            },
        });
    }

    static async verifySuperAdminLogin(req: Request, res: Response) {
        const { otpToken, otpCode } = req.body;

        
        try {
            // Verify the OTP token and extract the original OTP
            const decoded = AuthUtil.verifyAdminOTPToken(otpToken);
            console.log({ body: req.body, decoded });
            
            if (decoded.type !== 'otp_verification') {
                throw new BadRequestError('Invalid token type');
            }

            // Compare the OTP from token with the one provided
            if (otpCode !== decoded.otpCode) {
                throw new BadRequestError('Invalid verification code');
            }

            let emailToUse = decoded.email;
            let adminData = { email: emailToUse, name: 'Owner', isSuperAdmin: true };
            if (decoded.email !== ADMIN_EMAIL) {
                const checkAdmin = await AdminService.getAdminByEmail(decoded.email);
                emailToUse = checkAdmin.email;
                adminData = checkAdmin;
            }
            // Generate admin access token
            const adminToken = await AuthUtil.generateAdminToken({
                type: 'admin',
                identifier: adminData.email,
            });

            res.status(200).json({
                status: 'success',
                message: 'Admin login successful',
                data: { adminToken, admin: adminData },
            });
        } catch (error) {
            if (error instanceof TokenExpiredError) {
                throw new BadRequestError('Verification code has expired');
            }
            throw error;
        }
    }

    static async createAdmin(req: AdminAuthenticatedRequest, res: Response) {
        const { name, email, isSuperAdmin } = req.body;

        if (req.admin.isSuperAdmin === false) {
            throw new ForbiddenError('Only super admin can create new admins');
        }

        const newAdmin = await AdminService.createAdmin({ name, email, isSuperAdmin });

        res.status(201).json({
            status: 'success',
            message: 'New admin created successfully',
            data: newAdmin,
        });
    }

    static async getAllAdmins(req: AdminAuthenticatedRequest, res: Response) {
        // Check if the requester is the super admin
        if (req.admin.isSuperAdmin === false) {
            throw new ForbiddenError('Only super admin can view all admins');
        }

        const admins = await AdminService.getAllAdmins();

        res.status(200).json({
            status: 'success',
            message: 'All admins retrieved successfully',
            data: admins,
        });
    }

    static async deleteAdmin(req: AdminAuthenticatedRequest, res: Response) {
        const { id } = req.query;

        if (req.admin.isSuperAdmin === false) {
            throw new ForbiddenError('Only super admin can delete admins');
        }

        // admin cannot delete self
        if (id === req.admin.id) {
            throw new ForbiddenError('You cannot delete yourself');
        }

        await AdminService.deleteAdmin(id as string);

        res.status(200).json({
            status: 'success',
            message: 'Admin deleted successfully',
            data: null,
        });
    }

    static async blockUser(req: AdminAuthenticatedRequest, res: Response) {
        const { id, status } = req.query;
        const { reason } = req.body;

        if (req.admin.isSuperAdmin === false) {
            throw new ForbiddenError('Only super admin can block users');
        }

        if (status !== 'true' && status !== 'false') {
            throw new BadRequestError('Invalid status value');
        }

        if (!reason || typeof reason !== 'string') {
            throw new BadRequestError('Reason is required and must be a string');
        }

        await AdminService.blockUser(id as string, status === 'true', reason);

        res.status(200).json({
            status: 'success',
            message: status === 'true' ? 'User blocked successfully' : 'User unblocked successfully',
            data: null,
        });
    }

    static async deactivateUser(req: AdminAuthenticatedRequest, res: Response) {
        const { isDeactivated, id } = req.query;

        if (!id) {
            throw new BadRequestError('User ID is required');
        }

        if (isDeactivated === undefined || (isDeactivated !== 'true' && isDeactivated !== 'false')) {
            throw new BadRequestError('Invalid or missing isDeactivated value');
        }

        // Fetch the user
        const user = await UserService.viewSingleUser(id as string);

        const state: boolean = isDeactivated === 'true';

        // Check if the status is actually changing
        if (state === user.settings.isDeactivated) {
            throw new BadRequestError('User is already in the desired deactivated state');
        }

        // Update the user's settings
        await UserService.updateUserSettings(user.id, { isDeactivated: state });

        res.status(200).json({
            status: 'success',
            message: state ? 'User deactivated successfully' : 'User reactivated successfully',
            data: null,
        });
    }

    static async getInvestmentsOverview(req: Request, res: Response) {
        const overview = await InvestmentService.getInvestmentsOverview();
        res.status(200).json({
            status: 'success',
            message: 'Investment overview retrieved successfully',
            data: overview,
        });

    }

    static async getOverallMetrics(req: Request, res: Response) {
        const metrics = await AdminService.getOverallMetrics();

        res.status(200).json({
            status: 'success',
            message: 'Overall metrics retrieved successfully',
            data: metrics,
        });
    }

    static async getTimeBasedMetrics(req: Request, res: Response) {
        const period = (req.query.period as TimePeriod) || TimePeriod.MONTH;
        const metrics = await AdminService.getTimeBasedMetrics(period);

        res.status(200).json({
            status: 'success',
            message: 'Time-based metrics retrieved successfully',
            data: metrics,
        });
    }

}