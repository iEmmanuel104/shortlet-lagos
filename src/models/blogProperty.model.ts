import { Table, Column, Model, ForeignKey } from 'sequelize-typescript';
import Blog from './blog.model';
import Property from './property.model';

@Table
export default class BlogProperty extends Model {
    @ForeignKey(() => Blog)
    @Column
        blogId: string;

    @ForeignKey(() => Property)
    @Column
        propertyId: string;
}