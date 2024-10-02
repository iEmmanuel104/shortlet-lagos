// import { Request, Response } from 'express';
// import { BadRequestError, ForbiddenError } from '../utils/customErrors';
// import Validator from '../utils/validators';
// import Password from '../models/password.model';
// import { AuthUtil } from '../utils/token';
// import { logger } from '../utils/logger';
// import { Database } from '../models/index';
// import { emailService, EmailTemplate } from '../utils/Email';
// import UserService, { IDynamicQueryOptions } from '../services/user.service';
// import { AuthenticatedRequest } from '../middlewares/authMiddleware';
// import { WEBSITE_URL } from '../utils/constants';
// import { Transaction } from 'sequelize';

// export default class AuthController {

//     static async signup(req: Request, res: Response) {
//         const { email, firstName, lastName, password } = req.body;

//         await UserService.isEmailAndUsernameAvailable(email);

//         const newUser = await UserService.addUser({
//             email,
//             firstName,
//             lastName,
//             status: {
//                 activated: false,
//                 emailVerified: false,
//             },
//         });


//         const otpCode = await AuthUtil.generateCode({ type: 'emailverification', identifier: newUser.id, expiry: 60 * 10 });


//         const templateData = {
//             otpCode,
//             name: firstName,
//         };

//         console.log('sending email');
//         await emailService.send({
//             email: 'batch',
//             subject: 'Account Activation',
//             from: 'auth',
//             isPostmarkTemplate: true,
//             postMarkTemplateAlias: 'verify-email',
//             postmarkInfo: [{
//                 postMarkTemplateData: templateData,
//                 receipientEmail: email,
//             }],
//             html: await new EmailTemplate().accountActivation({ otpCode, name: firstName }),
//         });

//         const validPassword = Validator.isValidPassword(password);

//         if (!validPassword) {
//             throw new BadRequestError('Invalid password format');
//         }

//         // Create a new password for the user
//         await Password.create({ userId: newUser.id, password: password });

//         res.status(201).json({
//             status: 'success',
//             message: 'Email verification code sent successfully',
//             data: {
//                 user: newUser,
//             },
//         });
//     }

//     static async verifyEmail(req: Request, res: Response) {
//         const { otpCode, email }: { otpCode: string, email: string } = req.body;

//         await Database.transaction(async (transaction: Transaction) => {


//             const user = await UserService.viewSingleUserByEmail(email, transaction);

//             if (user.status.emailVerified) throw new BadRequestError('Email already verified');

//             const validCode = await AuthUtil.compareCode({ user, tokenType: 'emailverification', token: otpCode });
//             if (!validCode) throw new BadRequestError('Invalid otp code');

//             await user.update({ status: { ...user.status, emailVerified: true } }, { transaction });

//             await AuthUtil.deleteToken({ user, tokenType: 'emailverification', tokenClass: 'code' });

//             const accessToken = await AuthUtil.generateToken({ type: 'access', user });
//             const refreshToken = await AuthUtil.generateToken({ type: 'refresh', user });

//             res.status(200).json({
//                 status: 'success',
//                 message: 'Email verified successfully',
//                 data: {
//                     user: user.dataValues,
//                     accessToken,
//                     refreshToken,
//                 },
//             });
//         });
//     }

//     static async resendVerificationEmail(req: Request, res: Response) {
//         const email = req.query.email as string;

//         const user = await UserService.viewSingleUserByEmail(email);

//         if (user.status.emailVerified) {
//             throw new BadRequestError('Email already verified');
//         }

//         const otpCode = await AuthUtil.generateCode({ type: 'emailverification', identifier: user.id, expiry: 60 * 10 });

//         const templateData = {
//             otpCode,
//             name: user.firstName,
//         };

//         console.log('sending email');
//         await emailService.send({
//             email: 'batch',
//             subject: 'Account Activation',
//             from: 'auth',
//             isPostmarkTemplate: true,
//             postMarkTemplateAlias: 'verify-email',
//             postmarkInfo: [{
//                 postMarkTemplateData: templateData,
//                 receipientEmail: email,
//             }],
//             html: await new EmailTemplate().accountActivation({ otpCode, name: user.firstName }),
//         });
//         res.status(200).json({
//             status: 'success',
//             message: 'Email verification code resent successfully',
//             data: null,
//         });
//     }

//     static async forgotPassword(req: Request, res: Response) {
//         const { email, redirectUrl } = req.body;

//         console.log({ email, redirectUrl });

//         const user = await UserService.viewSingleUserByEmail(email);

//         if (!user) {
//             throw new BadRequestError('Oops User not found');
//         }

//         const resetToken = await AuthUtil.generateCode({ type: 'passwordreset', identifier: user.id, expiry: 60 * 10 });
//         const redirectLink: string = redirectUrl ? redirectUrl : `${WEBSITE_URL}/reset-password`;

//         const resetLink = `${redirectLink}?prst=${resetToken}&e=${encodeURIComponent(email)}`;

//         const templateData = {
//             link: resetLink,
//             name: user.firstName,
//         };

//         // TODO: Send email with the reset password link with the resetToken as query param
//         await emailService.send({
//             email: 'batch',
//             subject: 'Password Reset 🔑',
//             from: 'auth',
//             isPostmarkTemplate: true,
//             postMarkTemplateAlias: 'password-reset',
//             postmarkInfo: [{
//                 postMarkTemplateData: templateData,
//                 receipientEmail: email,
//             }],
//             html: await new EmailTemplate().forgotPassword({ link: resetLink, name: user.firstName }),
//         });

//         res.status(200).json({
//             status: 'success',
//             message: 'Reset password instructions sent successfully',
//             data: null,
//         });
//     }

//     static async resetPassword(req: Request, res: Response) {
//         const { resetToken, email, newPassword }: { resetToken: string, email: string, newPassword: string } = req.body;

//         const validPassword = Validator.isValidPassword(newPassword);
//         if (!validPassword) {
//             throw new BadRequestError('Invalid password format');
//         }

//         const user = await UserService.viewSingleUserByEmail(email);

//         const validCode = await AuthUtil.compareCode({ user, tokenType: 'passwordreset', token: resetToken });

//         if (!validCode) {
//             throw new BadRequestError('Invalid reset token');
//         }

//         const password = await user.$get('password');
//         if (!password) {
//             // if email is verified and not activated, create new password for user
//             if (!user.status.activated) {
//                 if (!user.status.emailVerified) {
//                     user.update({ status: { ...user.status, emailVerified: true } });
//                 }
//                 // create new password for user
//                 await Password.create({ userId: user.id, password: newPassword });
//             } else {
//                 throw new ForbiddenError('Please contact support');
//             }
//         } else {
//             // await Password.update({ password: newPassword }, { where: { id: password.id } });
//             password.password = newPassword;
//             await password.save();
//         }

//         // await AuthUtil.deleteToken({ user, tokenType: 'passwordreset', tokenClass: 'token' });

//         res.status(200).json({
//             status: 'success',
//             message: 'Password reset successfully. Please login with your new password',
//             data: null,
//         });
//     }

//     static async changePassword(req: AuthenticatedRequest, res: Response) {
//         const { oldPassword, newPassword }: { oldPassword: string, newPassword: string } = req.body;

//         const validPassword = Validator.isValidPassword(newPassword);
//         if (!validPassword) {
//             throw new BadRequestError('Invalid password');
//         }

//         const { id } = req.user;
//         const user = await UserService.viewSingleUser(id);

//         const password = await user.$get('password');
//         if (!password) throw new ForbiddenError('Please contact support');

//         const validOldPassword = await password.isValidPassword(oldPassword);
//         if (!validOldPassword) {
//             throw new BadRequestError('Invalid old password');
//         }

//         await password.update({ password: newPassword });

//         res.status(200).json({
//             status: 'success',
//             message: 'Password changed successfully',
//             data: null,
//         });
//     }

//     static async login(req: Request, res: Response) {
//         const { password } = req.body;
//         let data;

//         if (req.body.email) {
//             data = { email: req.body.email };
//         } else {
//             throw new BadRequestError('Please provide email');
//         }
//         logger.info('signing in with: ', data);

//         const queryOptions: IDynamicQueryOptions = {
//             query: data,
//         };
//         const user = await UserService.viewSingleUserDynamic(queryOptions);

//         if (!user.status.emailVerified) {
//             const otpCode = await AuthUtil.generateCode({ type: 'emailverification', identifier: user.id, expiry: 60 * 10 });
//             // send email to user to verify email
//             const templateData = {
//                 otpCode,
//                 name: user.firstName,
//             };

//             console.log('sending email');
//             await emailService.send({
//                 email: 'batch',
//                 subject: 'Account Activation',
//                 from: 'auth',
//                 isPostmarkTemplate: true,
//                 postMarkTemplateAlias: 'verify-email',
//                 postmarkInfo: [{
//                     postMarkTemplateData: templateData,
//                     receipientEmail: user.email,
//                 }],
//                 html: await new EmailTemplate().accountActivation({ otpCode, name: user.firstName }),
//             });
//             throw new BadRequestError('An Email verification code has been sent to your email. Please verify your email');
//         }

//         const userPassword = await user.$get('password');
//         if (!userPassword) {
//             throw new BadRequestError('Oops Please set a password, you can do that by clicking on the forgot password link');
//         }

//         const validPassword = await userPassword.isValidPassword(password);
//         if (!validPassword) {
//             throw new BadRequestError('Invalid credential combination');
//         }

//         if (user.settings.isBlocked) {
//             throw new ForbiddenError('Oops! Your account has been blocked. Please contact support');
//         }

//         if (!user.status.activated) {
//             await user.update({ status: { ...user.status, activated: true } });
//         }

//         const accessToken = await AuthUtil.generateToken({ type: 'access', user });
//         const refreshToken = await AuthUtil.generateToken({ type: 'refresh', user });

//         // // update the last Login for the user
//         // await UserService.updateUserSettings(user.id, { lastLogin: new Date() });

//         res.status(200).json({
//             status: 'success',
//             message: 'Login successful',
//             data: {
//                 user: user.dataValues,
//                 accessToken,
//                 refreshToken,
//             },
//         });
//     }

//     static async logout(req: AuthenticatedRequest, res: Response) {

//         await AuthUtil.deleteToken({ user: req.user, tokenType: 'access', tokenClass: 'token' });
//         await AuthUtil.deleteToken({ user: req.user, tokenType: 'refresh', tokenClass: 'token' });

//         res.status(200).json({
//             status: 'success',
//             message: 'Logout successful',
//             data: null,
//         });
//     }

//     static async getLoggedUserData(req: AuthenticatedRequest, res: Response) {
//         const user = req.user;

//         res.status(200).json({
//             status: 'success',
//             message: 'user data retrieved successfully',
//             data: {
//                 user: user.dataValues,
//             },
//         });
//     }

// }