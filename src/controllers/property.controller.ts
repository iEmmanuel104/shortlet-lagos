import { Request, Response } from 'express';
import PropertyService, { IViewPropertiesQuery, TimePeriod } from '../services/property.service';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { BadRequestError } from '../utils/customErrors';
import { IProperty } from '../models/property.model';
import { UserType } from '../models/user.model';
import CloudinaryClientConfig from '../clients/cloudinary.config';
import { ITokenomics } from '../models/tokenomics.model';

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

        // Verify user exists and is a property owner
        const user = req.user;

        if (user.type !== UserType.PROJECT_OWNER) {
            throw new BadRequestError('User is not a property owner');
        }

        const propertyData = {
            ...req.body,
            isDraft: true,
            ownerId: req.user.id,
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

        // Check ownership
        if (property.ownerId !== req.user.id) {
            throw new BadRequestError('Unauthorized to update this property');
        }

        // Handle file operations and property data updates separately
        // eslint-disable-next-line no-undef
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const propertyData = { ...req.body };

        // Prepare arrays for file operations
        const fileOperations: {
            add?: { [key: string]: string[] };
            remove?: { [key: string]: string[] };
        } = {};

        // Handle file removal requests from the body
        if (propertyData.removeFiles) {
            try {
                const removeFiles = JSON.parse(propertyData.removeFiles);
                delete propertyData.removeFiles;

                // Validate and prepare file removal
                if (removeFiles.gallery) {
                    property.gallery = property.gallery.filter(
                        url => !removeFiles.gallery.includes(url)
                    );
                }
                if (removeFiles.document) {
                    property.document = property.document.filter(
                        url => !removeFiles.document.includes(url)
                    );
                }
                if (removeFiles.banner) {
                    property.banner = '';
                }

                fileOperations.remove = removeFiles;
            } catch (error) {
                throw new BadRequestError('Invalid removeFiles format');
            }
        }

        // Handle new file uploads
        let uploadedUrls: Partial<IProperty> = {};
        if (Object.keys(files).length > 0) {
            uploadedUrls = await PropertyController.handleFileUploads(files, req.user.id);

            // Merge new files with existing ones
            if (uploadedUrls.gallery) {
                property.gallery = [...(property.gallery || []), ...(uploadedUrls.gallery as string[])];
                propertyData.gallery = property.gallery;
            }
            if (uploadedUrls.document) {
                property.document = [...(property.document || []), ...(uploadedUrls.document as string[])];
                propertyData.document = property.document;
            }
            if (uploadedUrls.banner) {
                propertyData.banner = uploadedUrls.banner;
            }

            fileOperations.add = uploadedUrls as { [key: string]: string[] };
        }

        // Parse JSON fields if they exist
        ['metrics', 'listingPeriod'].forEach(field => {
            if (propertyData[field] && typeof propertyData[field] === 'string') {
                try {
                    propertyData[field] = JSON.parse(propertyData[field]);
                } catch (error) {
                    throw new BadRequestError(`Invalid ${field} format`);
                }
            }
        });

        // Only validate data if there are non-file updates
        let validatedData = propertyData;
        if (Object.keys(propertyData).length > 0) {
            validatedData = await PropertyService.validatePropertyData({
                ...property.toJSON(),
                ...propertyData,
            });
        }

        console.log({ validatedData });

        // Update property with merged data
        const updatedProperty = await PropertyService.updateProperty(property, validatedData);

        // Clean up old files in Cloudinary if needed
        // if (fileOperations.remove) {
        //     try {
        //         await PropertyController.cleanupRemovedFiles(fileOperations.remove);
        //     } catch (error) {
        //         console.error('Error cleaning up files:', error);
        //         // Don't throw error as the property update was successful
        //     }
        // }

        res.status(200).json({
            status: 'success',
            message: 'Property updated successfully',
            data: updatedProperty,
        });
    }

    static async updatePropertyTokenomics(req: AuthenticatedRequest, res: Response) {
        const { id } = req.params;
        const tokenomicsData = req.body as ITokenomics;

        if (!id) {
            throw new BadRequestError('Property ID is required');
        }

        const property = await PropertyService.viewProperty(id);

        // Check ownership
        if (property.ownerId !== req.user.id) {
            throw new BadRequestError('Unauthorized to update this property');
        }

        const updatedProperty = await PropertyService.updatePropertyTokenomics(id, tokenomicsData);

        res.status(200).json({
            status: 'success',
            message: 'Property tokenomics updated successfully',
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
            document: [],
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

        // Upload gallery images
        if (files.gallery) {
            const galleryUploads = files.gallery.map(async (file, index) => {
                const result = await CloudinaryClientConfig.uploadtoCloudinary({
                    fileBuffer: file.buffer,
                    id: `${userId}_gallery_${index}`,
                    name: file.originalname,
                    type: 'image',
                });
                return result.url as string;
            });

            uploadedUrls.gallery = await Promise.all(galleryUploads);
        }

        // Upload documents
        if (files.doc) {
            const documentUploads = files.doc.map(async (file, index) => {
                const result = await CloudinaryClientConfig.uploadtoCloudinary({
                    fileBuffer: file.buffer,
                    id: `${userId}_doc_${index}`,
                    name: file.originalname,
                    type: 'document',
                });
                return result.url as string;
            });

            uploadedUrls.document = await Promise.all(documentUploads);
        }

        return uploadedUrls;
    }

    // private static async cleanupRemovedFiles(removedFiles: { [key: string]: string[] }) {
    //     const deletePromises: Promise<void>[] = [];

    //     Object.values(removedFiles).flat().forEach(url => {
    //         if (url) {
    //             deletePromises.push(
    //                 CloudinaryClientConfig.deleteFromCloudinary(url)
    //                     .catch(error => console.error(`Failed to delete file ${url}:`, error))
    //             );
    //         }
    //     });

    //     await Promise.all(deletePromises);
    // }

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

        // Get query parameters with type checking
        const includeTimeSeries = req.query.includeTimeSeries === 'true';
        const period = req.query.period as string;

        // Validate period if provided
        let validatedPeriod: TimePeriod | undefined;
        if (period) {
            if (!Object.values(TimePeriod).includes(period as TimePeriod)) {
                throw new BadRequestError('Invalid period. Must be one of: day, week, month');
            }
            validatedPeriod = period as TimePeriod;
        }

        const stats = await PropertyService.getPropertyOwnerStats(
            user.id,
            includeTimeSeries,
            validatedPeriod
        );

        res.status(200).json({
            status: 'success',
            message: 'Property owner statistics retrieved successfully',
            data: stats,
        });
    }
}