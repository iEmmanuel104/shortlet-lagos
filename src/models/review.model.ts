import {
    BelongsTo, Column, DataType, Default, ForeignKey,
    IsUUID, Model, PrimaryKey, Table,
    AfterCreate,
    AfterUpdate,
    BeforeDestroy,
} from 'sequelize-typescript';
import User from './user.model';
import Property from './property.model';
import { updatePropertyStatsRating } from './propertyStats.model';

@Table
export default class Review extends Model<Review | IReview> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column
        id: string;

    @Column({ type: DataType.TEXT })
        comment: string;

    @Column({
        type: DataType.INTEGER,
        validate: {
            min: 1,
            max: 5,
        },
    })
        rating: number;

    @IsUUID(4)
    @ForeignKey(() => User)
    @Column
        reviewerId: string;

    @BelongsTo(() => User, 'reviewerId')
        reviewer: User;

    @IsUUID(4)
    @ForeignKey(() => Property)
    @Column({ allowNull: true })
        propertyId: string;

    @BelongsTo(() => Property, 'PropertyId')
        property: Property;


    @AfterCreate
    static async updateStatsAfterCreate(instance: Review) {
        await updatePropertyStatsRating(instance.propertyId, instance.rating, true);
    }

    @AfterUpdate
    static async updateStatsAfterUpdate(instance: Review) {
        if (instance.previous('rating') !== instance.rating) {
            await updatePropertyStatsRating(instance.propertyId, instance.rating, false, instance.previous('rating'));
        }
    }

    @BeforeDestroy
    static async updateStatsBeforeDestroy(instance: Review) {
        await updatePropertyStatsRating(instance.propertyId, instance.rating, false);
    }
}

export interface IReview {
    id: string;
    comment: string;
    rating: number;
    reviewerId: string;
    propertyId?: string | null;
}
