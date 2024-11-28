import { DecodedTokenData, ENCRYPTEDTOKEN } from '../utils/interface';
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, NotFoundError, ForbiddenError, TokenExpiredError } from '../utils/customErrors';
import User from '../models/user.model';
import UserService from '../services/user.service';
import { AuthUtil } from '../utils/token';
import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model';
import { ADMIN_EMAIL } from '../utils/constants';
import AdminService from '../services/AdminServices/admin.service';


export interface AuthenticatedRequest extends Request {
    user: User;
}

export interface AdminAuthenticatedRequest extends Request {
    isSuperAdmin: boolean;
    email: string;
    admin: Admin;
}

// eslint-disable-next-line no-unused-vars
export type AuthenticatedAsyncController<T = AuthenticatedRequest> = (req: T, res: Response, next: NextFunction) => Promise<void>;

export function AuthenticatedController<T = AuthenticatedRequest>(
    controller: AuthenticatedAsyncController<T>
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        return controller(req as T, res, next);
    };
}

export function AdminAuthenticatedController<T = AdminAuthenticatedRequest>(
    controller: AuthenticatedAsyncController<T>
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        return controller(req as T, res, next);
    };
}

export const basicAuth = function () {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer'))
            return next(new UnauthorizedError('Invalid authorization header'));

        const jwtToken = authHeader.split(' ')[1];

        try {
            const payload = await AuthUtil.decodeToken(jwtToken) as unknown as DecodedTokenData;
            if (!payload || !payload.user || !payload.user.walletAddress) {
                throw new UnauthorizedError('Invalid token');
            }

            const user: User | null = await UserService.viewSingleUser(payload.user.id);
            if (!user) {
                throw new NotFoundError('User not found');
            }

            if (req.method === 'GET' && req.path === '/refreshtoken' && payload.tokenType === 'refresh') {

                AuthUtil.verifyToken(jwtToken, user.walletAddress);

                const newAccessToken = await AuthUtil.generateToken({ type: 'access', user });

                return res.status(200).json({
                    status: 'success',
                    message: 'Token refreshed successfully',
                    data: {
                        accessToken: newAccessToken,
                    },
                });
            }

            AuthUtil.verifyToken(jwtToken, user.walletAddress);

            if (user.settings.isBlocked) {
                throw new ForbiddenError('Account blocked. Please contact support');
            }

            if (user.settings.isDeactivated) {
                throw new ForbiddenError('Account deactivated. Please contact support');
            }

            (req as AuthenticatedRequest).user = user;

            next();
        } catch (error) {
            next(error);
        }
    };
};

export const adminAuth = function (tokenType: ENCRYPTEDTOKEN) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer')) {
            throw new UnauthorizedError('Invalid authorization header');
        }

        const jwtToken = authHeader.split(' ')[1];

        try {
            const payload = AuthUtil.verifyAdminToken(jwtToken, tokenType);
            const tokenData = payload as unknown as Omit<DecodedTokenData, 'user'>;

            if (tokenData.tokenType !== 'admin') {
                throw new UnauthorizedError('You are not authorized to perform this action');
            }

            let emailToUse = (tokenData.authKey as string).toLowerCase().trim();

            if ((tokenData.authKey as string) !== ADMIN_EMAIL) {
                const admin = await AdminService.getAdminByEmail(tokenData.authKey as string);

                if (!admin) {
                    throw new NotFoundError('Admin not found');
                }

                emailToUse = admin.email;
                (req as AdminAuthenticatedRequest).admin = admin;
                (req as AdminAuthenticatedRequest).isSuperAdmin = admin.isSuperAdmin;
            } else {
                (req as AdminAuthenticatedRequest).isSuperAdmin = true;
            }

            (req as AdminAuthenticatedRequest).email = emailToUse;

            next();
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new TokenExpiredError('Admin session has expired');
            }
            next(error);
        }
    };
};

// Add custom middleware to allow optional authentication
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
    // check if the request has an authorization header and it is not an iAdmin request
    if (req.headers.authorization && !req.headers['x-iadmin-access'] && req.headers['x-iadmin-access'] !== 'true') {
        return basicAuth()(req, res, next);
    }
    return next();
};
