import express, { Router } from 'express';
import WithdrawalRequestController from '../controllers/withdrawalRequest.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
    .get('/', basicAuth(), AuthenticatedController(WithdrawalRequestController.getAllWithdrawalRequests))
    .get('/:id', basicAuth(), AuthenticatedController(WithdrawalRequestController.getWithdrawalRequestById))
    .post('/', basicAuth(), AuthenticatedController(WithdrawalRequestController.addWithdrawalRequest))
    .patch('/:id', basicAuth(), AuthenticatedController(WithdrawalRequestController.updateWithdrawalRequest))
    .delete('/:id', basicAuth(), AuthenticatedController(WithdrawalRequestController.deleteWithdrawalRequest))
    .post('/:id/approve', basicAuth(), AuthenticatedController(WithdrawalRequestController.approveWithdrawalRequest))
    .post('/:id/reject', basicAuth(), AuthenticatedController(WithdrawalRequestController.rejectWithdrawalRequest));

export default router;