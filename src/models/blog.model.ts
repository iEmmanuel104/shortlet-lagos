/* eslint-disable no-unused-vars */
// blog.model.ts
import { Table, Column, Model, DataType, IsUUID, PrimaryKey, Default, HasMany } from 'sequelize-typescript';
import BlogActivity from './blogActivity.model';

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
    };

    @Column({
        type: DataType.ENUM,
        values: Object.values(BlogStatus),
        defaultValue: BlogStatus.Draft,
    })
        status: BlogStatus;

    @Column({ type: DataType.ARRAY(DataType.STRING), allowNull: true })
        tags: string[];

    @Column({
        type: DataType.JSONB,
        allowNull: false,
    })
        author: {
        name: string;
        email: string;
        image?: string;
        bio?: string;
    };

    @HasMany(() => BlogActivity)
        activities: BlogActivity[];
}

export interface IBlog {
    title: string;
    content: string;
    media?: {
        images?: string[];
        videos?: string[];
    };
    status?: BlogStatus;
    tags?: string[];
    author: {
        name: string;
        email: string;
        image?: string;
        bio?: string;
    };
}
