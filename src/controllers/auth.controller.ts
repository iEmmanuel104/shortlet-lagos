import { Request, Response } from 'express';
import { BadRequestError, ForbiddenError } from '../utils/customErrors';
// import Validator from '../utils/validators';
// import Password from '../models/password.model';
import { AuthUtil } from '../utils/token';
// import { emailService, EmailTemplate } from '../utils/Email';
import UserService from '../services/user.service';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { UserType } from '../models/user.model';
import ReferralService from '../services/referral.service';

export default class AuthController {

    static async signup(req: Request, res: Response) {
        const { walletAddress, username, type, referralName, phone, address } = req.body;

        // check if the type atches any in the enum
        if (!Object.values(UserType).includes(type)) {
            throw new BadRequestError(`User type: Must be one of ${Object.values(UserType).join(', ')}`);
        }

        await UserService.isWalletAddressEmailAndUserNameAvailable(walletAddress, username);

        const newUser = await UserService.addUser({
            walletAddress,
            // email,
            // firstName,
            // lastName,
            username,
            status: {
                activated: false,
                emailVerified: false,
                walletVerified: true,
            },
            type,
            phone,
            address,
        });

        if (referralName) {
            const refereeId = await UserService.viewSingleUserByUsername(referralName);
            if (refereeId) {
                await ReferralService.createReferral({ refereeId: refereeId.id, referredId: newUser.id });
            }
        }

        res.status(201).json({
            status: 'success',
            message: 'Email verification code sent successfully',
            data: {
                user: newUser,
            },
        });
    }

    static async verifyWallet(req: Request, res: Response) {
        const { walletAddress, signature } = req.body;

        const user = await UserService.viewSingleUserByWalletAddress(walletAddress);

        if (!user) {
            res.status(200).json({
                status: 'success',
                message: 'User not found',
                data: null,
            });
            return;
        }
        
        if (user.settings.isBlocked) {
            throw new ForbiddenError('Oops! Your account has been blocked. Please contact support');
        }
        // Verify the signature here
        const isValidSignature = AuthUtil.verifyWalletSignature(walletAddress, signature);
        if (!isValidSignature) throw new BadRequestError('Invalid signature');

        if (!user.status.walletVerified || !user.status.activated) {
            await user.update({ status: { ...user.status, walletVerified: true, activated: true } });
        }

        const accessToken = await AuthUtil.generateToken({ type: 'access', user });
        const refreshToken = await AuthUtil.generateToken({ type: 'refresh', user });

        res.status(200).json({
            status: 'success',
            message: 'Wallet verified successfully',
            data: {
                user: user.dataValues,
                accessToken,
                refreshToken,
            },
        });
    }

    static async logout(req: AuthenticatedRequest, res: Response) {
        // await AuthUtil.deleteToken({ user: req.user, tokenType: 'access', tokenClass: 'token' });
        // await AuthUtil.deleteToken({ user: req.user, tokenType: 'refresh', tokenClass: 'token' });

        res.status(200).json({
            status: 'success',
            message: 'Logout successful',
            data: null,
        });
    }

    static async getLoggedUserData(req: AuthenticatedRequest, res: Response) {
        const user = req.user;

        res.status(200).json({
            status: 'success',
            message: 'user data retrieved successfully',
            data: {
                user: user.dataValues,
            },
        });
    }
}