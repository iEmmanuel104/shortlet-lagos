import express, { Router } from 'express';
import ReferralController from '../controllers/referral.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
    .get('/', ReferralController.getAllReferrals)
    .get('/:id', ReferralController.getReferralById)
    .post('/', basicAuth(), AuthenticatedController(ReferralController.createReferral))
    .patch('/:id', basicAuth(), AuthenticatedController(ReferralController.updateReferral))
    .delete('/:id', basicAuth(), AuthenticatedController(ReferralController.deleteReferral));

export default router;