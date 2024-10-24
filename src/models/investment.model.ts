/* eslint-disable no-unused-vars */
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, IsUUID, PrimaryKey, Default, AfterCreate, AfterDestroy, AfterUpdate } from 'sequelize-typescript';
import User from './user.model';
import Property from './property.model';
import { calculateAndUpdateYield, updatePropertyInvestorCount } from './propertyStats.model';

export enum InvestmentStatus {
    Presale = 'presale',
    InitialRelease = 'initial_release',
    Vesting = 'vesting',
    Finish = 'finish'
}
@Table
export default class Investment extends Model<Investment | IInvestment> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column
        id: string;

    @ForeignKey(() => Property)
    @Column
        propertyId: string;

    @BelongsTo(() => Property)
        property: Property;

    @Column(DataType.DECIMAL(10, 2))
        amount: number;

    @Column(DataType.DATE)
        date: Date;

    @Column(DataType.INTEGER)
        sharesAssigned: number;

    @Column(DataType.DECIMAL(10, 2))
        estimatedReturns: number;

    @Column(DataType.ENUM(...Object.values(InvestmentStatus)))
        status: InvestmentStatus;

    @Column(DataType.STRING)
        propertyOwner: string;

    @ForeignKey(() => User)
    @Column
        investorId: string;

    @BelongsTo(() => User)
        investor: User;

    @AfterCreate
    static async handleAfterCreate(instance: Investment) {
        await updatePropertyInvestorCount(instance.propertyId, true);
        await calculateAndUpdateYield(instance.propertyId);
    }

    @AfterUpdate
    static async handleAfterUpdate(instance: Investment) {
        await calculateAndUpdateYield(instance.propertyId);
    }

    @AfterDestroy
    static async handleAfterDestroy(instance: Investment) {
        await updatePropertyInvestorCount(instance.propertyId, false);
        await calculateAndUpdateYield(instance.propertyId);
    }

}

export interface IInvestment {
    id?: string;
    propertyId: string;
    amount: number;
    date: Date;
    sharesAssigned: number;
    estimatedReturns: number;
    status: InvestmentStatus;
    propertyOwner: string;
    investorId: string;
}