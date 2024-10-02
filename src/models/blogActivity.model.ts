import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import Blog from './blog.model';
import User from './user.model';

@Table
export default class BlogActivity extends Model<BlogActivity | IBlogActivity> {
    @ForeignKey(() => User)
    @Column
        userId: string;

    @ForeignKey(() => Blog)
    @Column
        blogId: string;

    @Column({
        type: DataType.BOOLEAN,
        defaultValue: false,
    })
        liked: boolean;

    @Column({
        type: DataType.TEXT,
        allowNull: true,
    })
        comment: string | null;

    @BelongsTo(() => User)
        user: User;

    @BelongsTo(() => Blog)
        blog: Blog;
}

export interface IBlogActivity {
    userId: string;
    blogId: string;
    liked: boolean;
    comment: string | null;
}