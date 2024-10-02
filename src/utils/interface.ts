import User, { IUser } from '../models/user.model';

export interface SaveTokenToCache {
    key: string,
    token: string,
    expiry?: number
}

export type AuthToken = 'access' | 'refresh' | 'passwordreset' | 'emailverification' | 'setpassword' | 'adminlogin' | 'admin';

export type ENCRYPTEDTOKEN = AuthToken | 'admin'

export type AWSUploadType = 'profile' | 'posts' | 'document' | 'other';

export interface GenerateTokenData {
    type: AuthToken,
    user: User,
}
export interface GenerateAdminTokenData {
    type: AuthToken,
    identifier: string,
}

export interface GenerateCodeData {
    type: AuthToken,
    identifier: string,
    expiry: number,
}

export interface CompareTokenData {
    tokenType: AuthToken,
    user: IUser & { id: string },
    token: string
}
export interface CompareAdminTokenData {
    tokenType: AuthToken,
    identifier: string,
    token: string
}

export interface DeleteToken {
    tokenType: AuthToken,
    tokenClass: 'token' | 'code',
    user: IUser & { id: string },
}

export type DecodedUser = { id: string };

export interface DecodedTokenData {
    user: DecodedUser,
    token: string,
    tokenType: AuthToken
    authKey?: string
}

export interface AWSKeyData {
    id: string,
    fileName: string,
    type: AWSUploadType,
}