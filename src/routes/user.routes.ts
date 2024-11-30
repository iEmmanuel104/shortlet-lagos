import express, { Router } from 'express';
import UserController from '../controllers/user.controller';
import { AuthenticatedController, basicAuth, optionalAuth } from '../middlewares/authMiddleware';
import { uploadMiddleware, UploadType } from '../middlewares/uploadMiddleware';

const router: Router = express.Router();

// Configure the upload middleware for single file upload
const upload = uploadMiddleware(UploadType.Single, 'file');

router
    .post('/support-ticket', basicAuth(), AuthenticatedController(UserController.createSupportTicket))
    .get('/', UserController.getAllUsers)
    .get('/info', optionalAuth, AuthenticatedController(UserController.getUser))
    .patch('/update', optionalAuth, upload, AuthenticatedController(UserController.updateUser));
    
export default router;

