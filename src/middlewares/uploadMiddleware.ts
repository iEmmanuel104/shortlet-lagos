/* eslint-disable no-unused-vars */
import Multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { BadRequestError } from '../utils/customErrors';

export enum UploadType {
    Single = 'single',
    Array = 'array',
    Fields = 'fields'
}

// interface FileTypeMap {
//     mimeType: string;
//     extension: string;
// }

const allowedTypes = {
    image: [
        { mimeType: 'image/jpeg', extension: 'JPG/JPEG' },
        { mimeType: 'image/jpg', extension: 'JPG' },
        { mimeType: 'image/webp', extension: 'WEBP' },
        { mimeType: 'image/png', extension: 'PNG' },
    ],
    video: [
        { mimeType: 'video/x-flv', extension: 'FLV' },
        { mimeType: 'video/x-matroska', extension: 'MKV' },
        { mimeType: 'video/quicktime', extension: 'MOV' },
        { mimeType: 'video/mp4', extension: 'MP4' },
    ],
    audio: [
        { mimeType: 'audio/mpeg', extension: 'MP3' },
    ],
    document: [
        { mimeType: 'application/pdf', extension: 'PDF' },
        { mimeType: 'application/msword', extension: 'DOC' },
        { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'DOCX' },
        { mimeType: 'application/vnd.ms-excel', extension: 'XLS' },
        { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'XLSX' },
    ],
};

const getFileType = (mimetype: string): string => {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.startsWith('application/')) return 'document';
    return 'file';
};

const getReadableFileTypes = (type: string): string => {
    const typeMap = allowedTypes[type as keyof typeof allowedTypes] || [];
    return typeMap.map(t => t.extension).join(', ');
};

// eslint-disable-next-line no-undef
const fileFilter = (req: Request, file: Express.Multer.File, cb: Multer.FileFilterCallback): void => {
    console.log('mimetype ==>>',file.mimetype);
    const fileType = getFileType(file.mimetype);
    const typesList = allowedTypes[fileType as keyof typeof allowedTypes] || [];
    const allowedMimeTypes = typesList.map(t => t.mimeType);

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
        return;
    }

    const readableTypes = getReadableFileTypes(fileType);
    const errorMessage = `Unsupported ${fileType} format. Supported formats are: ${readableTypes}`;
    cb(new BadRequestError(errorMessage));
};

const multer = Multer({
    storage: Multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 * 300 }, // set max file size to 300 MB
    fileFilter: fileFilter,
});

export const uploadMiddleware = function (type: UploadType, nameOrFields: string | Multer.Field[], maxCount?: number) {
    return (req: Request, res: Response, next: NextFunction) => {
        console.log('uploadMiddleware triggered');

        let multerMiddleware;

        switch (type) {
        case UploadType.Single:
            multerMiddleware = multer.single(nameOrFields as string);
            break;
        case UploadType.Array:
            multerMiddleware = multer.array(nameOrFields as string, maxCount);
            break;
        case UploadType.Fields:
            multerMiddleware = multer.fields(nameOrFields as Multer.Field[]);
            break;
        default:
            throw new Error('Invalid upload type specified');
        }

        if (!req.file && (!req.files || (Array.isArray(req.files) && req.files.length === 0) || Object.keys(req.files).length === 0)) {
            console.log('No file uploaded, proceeding to next middleware');
        } else {
            console.log('File uploaded, proceeding to multer middleware');
        }
            
        multerMiddleware(req, res, (err) => {
            if (err) {
                return next(err);
            }
            console.log('Multer middleware completed, proceeding to next middleware');
            next();
        });
    };
};