/* eslint-disable no-unused-vars */
import {
    Table, Column, Model, DataType, HasOne, Default, BeforeFind, Scopes,
    IsEmail, IsUUID, PrimaryKey, Index, BeforeCreate, BeforeUpdate,
    Unique,
    HasMany,
} from 'sequelize-typescript';
import UserSettings from './userSettings.model';
import { FindOptions } from 'sequelize';
import Blog from './blog.model';
import BlogActivity from './blogActivity.model';
import Review from './review.model';
import VerificationDoc from './verificationDocs.model';
import WithdrawalRequest from './withdrawalRequest.model';
import Referral from './referral.model';
import SupportTicket from './supportTicket.model';
import Investment from './investment.model';
import Property from './property.model';

export enum UserType {
    INVESTOR = 'investor',
    PROJECT_OWNER = 'project_owner',
}

export enum WalletConnectionTypeOptions {
    WALLET_CONNECT = 'wallet_connect',
    TORONET = 'toronet',
}

@Scopes(() => ({
    withSettings: {
        include: [
            {
                model: UserSettings,
                as: 'settings',
                attributes: ['joinDate', 'isBlocked', 'isDeactivated', 'lastLogin', 'meta'],
            },
        ],
    },
}))
@Table
export default class User extends Model<User | IUser> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column
        id: string;


    @Unique
    @Column({
        type: DataType.STRING,
        allowNull: false,
        set(value: string) {
            this.setDataValue('walletAddress', value.toLowerCase());
        },
    })
        walletAddress: string;

    @IsEmail
    @Index
    @Column({
        type: DataType.STRING,
        allowNull: true,
        get() {
            const value = this.getDataValue('email');
            return value ? value.trim().toLowerCase() : null;
        },
        set(value: string | null) {
            if (value) {
                this.setDataValue('email', value.trim().toLowerCase());
            } else {
                this.setDataValue('email', null);
            }
        },
    })
        email?: string;

    @Index
    @Column({
        type: DataType.STRING,
        allowNull: true,
        set(value: string) {
            this.setDataValue('firstName', User.capitalizeFirstLetter(value));
        },
    })
        firstName: string;

    @Index
    @Column({
        type: DataType.STRING,
        allowNull: true,
        set(value: string) {
            this.setDataValue('lastName', User.capitalizeFirstLetter(value));
        },
    })
        lastName: string;

    @Column({
        type: DataType.STRING,
        set(value: string) {
            if (value) {
                this.setDataValue('otherName', User.capitalizeFirstLetter(value));
            }
        },
    })
        otherName: string;

    @Column({ type: DataType.STRING })
        gender: string;

    @Column({ type: DataType.STRING })
        displayImage: string;

    @Unique
    @Column({
        type: DataType.STRING, allowNull: false,
        get() {
            return this.getDataValue('username').trim().toLowerCase();
        }, set(value: string) {
            this.setDataValue('username', value.trim().toLowerCase());
        },
    })
        username: string;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        defaultValue: { activated: false, emailVerified: false, walletVerified: false, docsVerified: false },
    })
        status: {
            activated: boolean;
            emailVerified: boolean;
            walletVerified: boolean;
            docsVerified: boolean;
        };

    @Column({
        type: DataType.VIRTUAL,
        get() {
            if (this.getDataValue('otherName')) {
                return `${this.getDataValue('firstName')} ${this.getDataValue('lastName')} ${this.getDataValue('otherName')}`.trim();
            } else {
                return `${this.getDataValue('firstName')} ${this.getDataValue('lastName')}`.trim();
            }
        },
        set(value: string) {
            const names = value.split(' ');
            this.setDataValue('firstName', names[0]);
            this.setDataValue('lastName', names.slice(1).join(' '));
        },
    })
        fullName: string;

    @Column({ type: DataType.JSONB })
        phone: {
        countryCode: string;
        number: string;
    };

    @Column({
        type: DataType.DATEONLY,
        validate: {
            isDate: true,
            isValidDate(value: string | Date) {
                if (new Date(value) > new Date()) {
                    throw new Error('Date of birth cannot be in the future');
                }
            },
        },
    })
        dob: Date;

    @Column({ type: DataType.JSONB })
        address: {
        street: string;
        city: string;
        state: string;
        country: string;
    };

    @Column({
        type: DataType.ENUM,
        values: Object.values(UserType),
        allowNull: false,
        defaultValue: UserType.INVESTOR,
    })
        type: UserType;

    @Column({
        type: DataType.ENUM,
        values: Object.values(WalletConnectionTypeOptions),
        allowNull: false,
        defaultValue: WalletConnectionTypeOptions.WALLET_CONNECT,
    })
        walletConnectionType: WalletConnectionTypeOptions;

    @Column({ type: DataType.STRING })
        referralBonus: string;

    @HasOne(() => UserSettings)
        settings: UserSettings;

    @HasMany(() => Blog)
        blogs: Blog[];

    @HasMany(() => BlogActivity)
        blogActivities: BlogActivity[];

    @HasMany(() => Review)
        reviews: Review[];

    @HasMany(() => Referral, {
        foreignKey: 'refereeId',
        as: 'referrals',
    })
        referrals: Referral[];

    @HasMany(() => Referral, {
        foreignKey: 'referredId',
        as: 'referred',
    })
        referred: Referral[];

    @HasOne(() => VerificationDoc)
        verificationDoc: VerificationDoc[];

    @HasMany(() => WithdrawalRequest)
        withdrawalRequest: WithdrawalRequest[];

    @HasMany(() => SupportTicket)
        supportTickets: SupportTicket[];

    @HasMany(() => Property, {
        foreignKey: 'ownerId',
        as: 'properties',
    })
        properties: Property[];

    @HasMany(() => Investment, {
        foreignKey: 'investorId',
        as: 'investments',
    })
        investments: Investment[];

    @BeforeFind
    static beforeFindHook(options: FindOptions) {
        if (options.where && 'email' in options.where && typeof options.where.email === 'string') {
            const whereOptions = options.where as { email?: string };
            if (whereOptions.email) {
                whereOptions.email = whereOptions.email.trim().toLowerCase();
            }
        }
        if (options.where && 'walletAddress' in options.where && typeof options.where.walletAddress === 'string') {
            const whereOptions = options.where as { walletAddress?: string };
            if (whereOptions.walletAddress) {
                whereOptions.walletAddress = whereOptions.walletAddress.trim().toLowerCase();
            }
        }
    }

    @BeforeCreate
    @BeforeUpdate
    static beforeSaveHook(instance: User) {
        // Only capitalize if the field is changed (for updates) or new (for creates)
        if (instance.changed('firstName')) {
            instance.firstName = User.capitalizeFirstLetter(instance.firstName);
        }
        if (instance.changed('lastName')) {
            instance.lastName = User.capitalizeFirstLetter(instance.lastName);
        }
        if (instance.changed('otherName') && instance.otherName) {
            instance.otherName = User.capitalizeFirstLetter(instance.otherName);
        }
    }

    static capitalizeFirstLetter(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

export interface IUser {
    walletAddress: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    otherName?: string;
    username: string;
    status: {
        activated: boolean;
        docsVerified: boolean;
        emailVerified: boolean;
        walletVerified: boolean;
    };
    gender?: string;
    displayImage?: string;
    fullName?: string;
    phone?: {
        countryCode: string;
        number: string
    };
    dob?: Date;
    address?: {
        street: string;
        city: string;
        state: string;
        country: string;
    };
    type: UserType;
    walletConnectionType: WalletConnectionTypeOptions;
    referralBonus?: string;
}