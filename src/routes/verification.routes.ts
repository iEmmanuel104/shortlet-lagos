import express, { Router } from 'express';
import VerificationController from '../controllers/verification.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';
import { uploadMiddleware, UploadType } from '../middlewares/uploadMiddleware';

const router: Router = express.Router();

// Configure upload fields for verification documents
const verificationUploadFields = [
    { name: 'front', maxCount: 1 },    // For identity front
    { name: 'back', maxCount: 1 },     // For identity back
    { name: 'document', maxCount: 1 },  // For address proof
    { name: 'selfie', maxCount: 1 },    // For selfie
];

// Create upload middleware instance
const upload = uploadMiddleware(UploadType.Fields, verificationUploadFields);

router
    // Protected routes - User
    .get('/user-docs', basicAuth(), AuthenticatedController(VerificationController.getVerificationDocsByUser))
    .post('/documents', basicAuth(), upload, AuthenticatedController(VerificationController.addOrUpdateVerificationDocs))
    .post('/submit', basicAuth(), AuthenticatedController(VerificationController.submitForVerification))

    // Protected routes - Admin
    .get('/admin/all', basicAuth(), AuthenticatedController(VerificationController.getAllVerificationDocs))
    .patch('/admin/:userId/status', basicAuth(), AuthenticatedController(VerificationController.updateDocumentStatus));

export default router;
