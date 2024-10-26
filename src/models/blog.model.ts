/* eslint-disable no-unused-vars */
// blog.model.ts
import { Table, Column, Model, DataType, IsUUID, PrimaryKey, Default, HasMany, BelongsTo, ForeignKey } from 'sequelize-typescript';
import BlogActivity from './blogActivity.model';
import User from './user.model';

export enum BlogStatus {
    Draft = 'Draft',
    Published = 'Published',
    Archived = 'Archived'
}

@Table
export default class Blog extends Model<Blog | IBlog> {
    @IsUUID(4)
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column
        id: string;

    @Column({ type: DataType.STRING, allowNull: false })
        title: string;

    @Column({ type: DataType.TEXT, allowNull: false })
        content: string;

    @Column({
        type: DataType.JSONB,
        allowNull: true,
        defaultValue: {},
    })
        media: {
        images?: string[];
        videos?: string[];
        documents?: string[];
    };

    @Column({
        type: DataType.ENUM,
        values: Object.values(BlogStatus),
        defaultValue: BlogStatus.Draft,
    })
        status: BlogStatus;

    @Column({ type: DataType.ARRAY(DataType.STRING), allowNull: true })
        tags: string[];

    // @Column({
    //     type: DataType.JSONB,
    //     allowNull: false,
    // })
    //     author: {
    //     name: string;
    //     email: string;
    //     image?: string;
    //     bio?: string;
    // };

    @ForeignKey(() => User)
    @Column
        authorId: string;

    @HasMany(() => BlogActivity)
        activities: BlogActivity[];
    
    @BelongsTo(() => User)
        author: User;
}

export interface IBlog {
    title: string;
    content: string;
    media?: {
        images?: string[];
        videos?: string[];
        documents?: string[];
    };
    status?: BlogStatus;
    tags?: string[];
    authorId: string;
    // author: {
    //     name: string;
    //     email: string;
    //     image?: string;
    //     bio?: string;
    // };
}
