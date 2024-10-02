/* eslint-disable no-unused-vars */
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, IsUUID, PrimaryKey, Default } from 'sequelize-typescript';
import User from './user.model';

export enum DocType {
    IdCard = 'id_card',
    ProofOfAddress = 'proof_of_address',
    BusinessLicense = 'business_license'
}

export enum VerificationStatus {
    Pending = 'pending',
    Approved = 'approved',
    Rejected = 'rejected'
}
@Table
export default class VerificationDoc extends Model<VerificationDoc | IVerificationDoc> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column
        id: string;

    @ForeignKey(() => User)
    @Column
        userId: string;

    @BelongsTo(() => User)
        user: User;

    @Column(DataType.ENUM(...Object.values(DocType)))
        type: DocType;

    @Column(DataType.ENUM(...Object.values(VerificationStatus)))
        status: VerificationStatus;

    @Column(DataType.STRING)
        url: string;
}

export interface IVerificationDoc {
    id?: string;
    userId: string;
    type: DocType;
    status: VerificationStatus;
    url: string;
}