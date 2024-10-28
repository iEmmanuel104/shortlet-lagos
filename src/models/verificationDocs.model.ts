/* eslint-disable no-unused-vars */
import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import User from './user.model';

export enum VerificationStatus {
    Pending = 'pending',
    Submitted = 'submitted',
    Approved = 'approved',
    Rejected = 'rejected'
}

export enum DocumentProofType {
    // Identity documents
    PassportFront = 'passport_front',
    PassportBack = 'passport_back',
    DriverLicenseFront = 'driver_license_front',
    DriverLicenseBack = 'driver_license_back',
    NationalIdFront = 'national_id_front',
    NationalIdBack = 'national_id_back',

    // Address proof documents
    UtilityBill = 'utility_bill',
    BankStatement = 'bank_statement',
    RentProof = 'rent_proof',

    // Selfie verification
    Selfie = 'selfie'
}

export enum DocumentSection {
    Identity = 'identity',
    Address = 'address',
    Selfie = 'selfie'
}

export interface DocumentData {
    type: DocumentProofType;
    url: string;
    status: VerificationStatus;
    rejectionReason?: string;
}

@Table
export default class VerificationDoc extends Model<VerificationDoc | IVerificationDoc> {

    @ForeignKey(() => User)
    @Column
        userId: string;

    @BelongsTo(() => User)
        user: User;

    @Column(DataType.ENUM(...Object.values(VerificationStatus)))
        status: VerificationStatus;

    @Column(DataType.JSONB)
        documents: {
        [DocumentSection.Identity]: DocumentData[];
        [DocumentSection.Address]: DocumentData[];
        [DocumentSection.Selfie]: DocumentData[];
    };
}

export interface IVerificationDoc {
    userId: string;
    status: VerificationStatus;
    documents: {
        [DocumentSection.Identity]: DocumentData[];
        [DocumentSection.Address]: DocumentData[];
        [DocumentSection.Selfie]: DocumentData[];
    };
}