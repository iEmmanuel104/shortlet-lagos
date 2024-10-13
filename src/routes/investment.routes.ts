import express, { Router } from 'express';
import InvestmentController from '../controllers/investment.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
    .get('/', InvestmentController.getAllInvestments)
    .get('/:id', InvestmentController.getInvestmentById)
    .post('/', basicAuth(), AuthenticatedController(InvestmentController.addInvestment))
    .patch('/:id', basicAuth(), AuthenticatedController(InvestmentController.updateInvestment))
    .delete('/:id', AuthenticatedController(InvestmentController.deleteInvestment));

export default router;