import { Request, Response } from 'express';
import PropertyService, { IViewPropertiesQuery } from '../services/property.service';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { BadRequestError } from '../utils/customErrors';
import { IProperty } from '../models/property.model';
import { UserType } from '../models/user.model';
import CloudinaryClientConfig from '../clients/cloudinary.config';

export default class PropertyController {
    static async getAllProperties(req: Request, res: Response) {
        const { page, size, q, category, minPrice, maxPrice, ownerId } = req.query;

        const queryParams: IViewPropertiesQuery = {
            ...(page && size ? { page: Number(page), size: Number(size) } : {}),
            ...(q && { q: q as string }),
            ...(category && { category: category as string }),
            ...(minPrice && { minPrice: Number(minPrice) }),
            ...(maxPrice && { maxPrice: Number(maxPrice) }),
            ...(ownerId && { ownerId: ownerId as string }),
        };

        const properties = await PropertyService.viewProperties(queryParams);
        res.status(200).json({
            status: 'success',
            message: 'Properties retrieved successfully',
            data: { ...properties },
        });
    }

    static async getPropertyById(req: Request, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Property ID is required');
        }

        const isUserRequest = !!(req as AuthenticatedRequest).user; 

        const property = await PropertyService.viewProperty(id, isUserRequest);
        res.status(200).json({
            status: 'success',
            message: 'Property retrieved successfully',
            data: property,
        });
    }

    static async addProperty(req: AuthenticatedRequest, res: Response) {
        // eslint-disable-next-line no-undef
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const uploadedUrls = await PropertyController.handleFileUploads(files, req.user.id);

        const propertyData = {
            ...req.body,
            ...uploadedUrls,
        };

        const validatedData = await PropertyService.validatePropertyData(propertyData);
        const newProperty = await PropertyService.addProperty(validatedData as IProperty);

        res.status(201).json({
            status: 'success',
            message: 'Property added successfully',
            data: newProperty,
        });
    }

    static async updateProperty(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Property ID is required');
        }

        const property = await PropertyService.viewProperty(id);
        // eslint-disable-next-line no-undef
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const uploadedUrls = await PropertyController.handleFileUploads(files, req.user.id);

        const propertyData = {
            ...req.body,
            ...uploadedUrls,
        };

        const validatedData = await PropertyService.validatePropertyData(propertyData);
        const updatedProperty = await PropertyService.updateProperty(property, validatedData);

        res.status(200).json({
            status: 'success',
            message: 'Property updated successfully',
            data: updatedProperty,
        });
    }

    private static async handleFileUploads(
        // eslint-disable-next-line no-undef
        files: { [fieldname: string]: Express.Multer.File[] },
        userId: string
    ): Promise<Partial<IProperty>> {
        const uploadedUrls: Partial<IProperty> = {
            gallery: [],
        };

        if (!files) return uploadedUrls;

        // Upload banner
        if (files.banner?.[0]) {
            const result = await CloudinaryClientConfig.uploadtoCloudinary({
                fileBuffer: files.banner[0].buffer,
                id: userId,
                name: files.banner[0].originalname,
                type: 'image',
            });
            uploadedUrls.banner = result.url as string;
        }

        // Upload gallery images (up to 4 files)
        if (files.gallery) {
            const galleryUploads = files.gallery.map(async (file, index) => {
                const result = await CloudinaryClientConfig.uploadtoCloudinary({
                    fileBuffer: file.buffer,
                    id: `${userId}_gallery_${index}`, // Add index to make each upload unique
                    name: file.originalname,
                    type: 'image',
                });
                return result.url as string;
            });

            uploadedUrls.gallery = await Promise.all(galleryUploads);
        }

        // Upload document
        if (files.doc?.[0]) {
            const documentUploads = files.gallery.map(async (file, index) => {
                const result = await CloudinaryClientConfig.uploadtoCloudinary({
                    fileBuffer: file.buffer,
                    id: `${userId}_doc_${index}`, // Add index to make each upload unique
                    name: file.originalname,
                    type: 'document',
                });
                return result.url as string;
            });

            uploadedUrls.document = await Promise.all(documentUploads);
        }
        return uploadedUrls;
    }

    static async deleteProperty(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;

        if (!id) {
            throw new BadRequestError('Property ID is required');
        }

        const property = await PropertyService.viewProperty(id);
        await PropertyService.deleteProperty(property);
        res.status(200).json({
            status: 'success',
            message: 'Property deleted successfully',
            data: null,
        });
    }

    static async getOwnerStats(req: AuthenticatedRequest, res: Response) {
        // Verify user exists and is a property owner
        const user = req.user;

        if (user.type !== UserType.PROJECT_OWNER) {
            throw new BadRequestError('User is not a property owner');
        }

        const stats = await PropertyService.getPropertyOwnerStats(user.id);

        res.status(200).json({
            status: 'success',
            message: 'Property owner statistics retrieved successfully',
            data: stats,
        });
    }
}