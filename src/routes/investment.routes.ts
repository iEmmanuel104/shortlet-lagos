import express, { Router } from 'express';
import InvestmentController from '../controllers/investment.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
    .get('/', InvestmentController.getAllInvestments)
    .get('/:id', InvestmentController.getInvestmentById)
    .post('/', basicAuth(), AuthenticatedController(InvestmentController.addInvestment))
    .patch('/:id', basicAuth(), AuthenticatedController(InvestmentController.updateInvestment))
    .delete('/:id', AuthenticatedController(InvestmentController.deleteInvestment))
    .get(
        '/analytics/investor-stats',
        basicAuth(),
        AuthenticatedController(InvestmentController.getInvestorStats)
    )
    .get(
        '/analytics/metrics',
        basicAuth(),
        AuthenticatedController(InvestmentController.getInvestmentMetrics)
    )
    .get(
        '/analytics/top-investments',
        basicAuth(),
        AuthenticatedController(InvestmentController.getTopInvestments)
    );

export default router;