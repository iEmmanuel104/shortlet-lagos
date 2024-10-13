import express, { Router } from 'express';
import VerificationController from '../controllers/verification.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
    .get('/', basicAuth(), AuthenticatedController(VerificationController.getAllVerificationDocs))
    .get('/:id', basicAuth(), AuthenticatedController(VerificationController.getVerificationDocById))
    .post('/', basicAuth(), AuthenticatedController(VerificationController.addVerificationDoc))
    .patch('/:id', basicAuth(), AuthenticatedController(VerificationController.updateVerificationDoc))
    .delete('/:id', basicAuth(), AuthenticatedController(VerificationController.deleteVerificationDoc));

export default router;