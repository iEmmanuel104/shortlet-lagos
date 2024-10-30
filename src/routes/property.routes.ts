import express, { Router } from 'express';
import PropertyController from '../controllers/property.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';
import { uploadMiddleware, UploadType } from '../middlewares/uploadMiddleware';

const router: Router = express.Router();

// Configure the upload fields for properties
const propertyUploadFields = [
    { name: 'banner', maxCount: 1 },
    { name: 'gallery', maxCount: 4 },
    { name: 'doc', maxCount: 3 },
];

const upload = uploadMiddleware(UploadType.Fields, propertyUploadFields);

router
    .get('/', PropertyController.getAllProperties)
    .get('/:id', PropertyController.getPropertyById)
    .post('/', basicAuth(), AuthenticatedController(PropertyController.addProperty))
    .patch('/:id', basicAuth(), upload, AuthenticatedController(PropertyController.updateProperty))
    .patch('/:id/tokenomics', basicAuth(), AuthenticatedController(PropertyController.updatePropertyTokenomics))
    .get('/owner/stats', basicAuth(), AuthenticatedController(PropertyController.getOwnerStats))
    .get('/owner/top-investment', basicAuth(), AuthenticatedController(PropertyController.getTopPropertyInvestment))
    .delete('/:id', basicAuth(), AuthenticatedController(PropertyController.deleteProperty));

export default router;