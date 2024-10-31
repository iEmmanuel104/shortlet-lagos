/* eslint-disable no-unused-vars */
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

export type DecodedUser = { id: string, walletAddress: string };

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

export interface IInvestorStats {
    totalInvestments: number;
    totalInvestedAmount: number;
    accountValue: number;
    valueChange: {
        amount: number;
        percentage: number;
    };
    investments: {
        processing: {
            count: number;
            amount: number;
        };
        completed: {
            count: number;
            amount: number;
        };
    };
    rentals: {
        balance: number;
        totalEarned: number;
        pendingPayouts: number;
    };
    portfolio: {
        totalPropertyValue: number;
        valueChange: {
            amount: number;
            percentage: number;
        };
    };
}

export interface IInvestmentMetrics {
    period: string;
    investedAmount: number;
    propertyValue: number;
    rentalIncome: number;
}

export enum MetricsPeriod {
    DAY = 'day',
    WEEK = 'week',
    MONTH = 'month',
    SIXMONTH = 'sixmonth',
    YEAR = 'year',
    FIVEYEAR = 'fiveyear'
}

export interface ITopInvestment {
    propertyId: string;
    propertyName: string;
    location: string;
    investedAmount: number;
    currentValue: number;
    valueChange: {
        amount: number;
        percentage: number;
    };
    rentalYield: number;
    investmentDate: Date;
}

export interface IPropertyOwnerStats {
    totalListings: number;
    activeListings: number;
    totalInvestmentAmount: number;
    totalInvestorsCount: number;
    investments: {
        completed: {
            count: number;
            percentageChange: number;
        };
        pending: {
            count: number;
            percentageChange: number;
        };
    };
    recentActivity: {
        newInvestors: number;
        newInvestments: number;
    };
}

export enum TimePeriod {
    DAY = 'day',
    WEEK = 'week',
    MONTH = 'month'
}

// Stats data point interface
export interface TimeBasedStats {
    period: string;
    investmentAmount: number;
    investorCount: number;
}

// Time series data interface
export interface TimeSeriesData {
    period: TimePeriod;
    data: TimeBasedStats[];
}

// Extended stats interface
export interface IPropertyOwnerStatsWithTimeSeries extends IPropertyOwnerStats {
    timeSeriesData?: TimeSeriesData;
}

export interface ITopPropertyInvestment {
    id: string;
    name: string;
    location: string;
    banner: string;
    metrics: {
        MIA: number; // Minimum Investment Amount
    };
    stats: {
        totalInvestmentAmount: number;
        numberOfInvestors: number;
    };
    investmentTrend: {
        period: string;
        amount: number;
    }[];
}