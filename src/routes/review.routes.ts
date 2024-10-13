import express, { Router } from 'express';
import ReviewController from '../controllers/review.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
    .post('/', basicAuth(), AuthenticatedController(ReviewController.addReview))
    .delete('/', basicAuth(), AuthenticatedController(ReviewController.deleteReview))
    .get('/', ReviewController.viewReview)
    .get('/property', ReviewController.viewReviewsByProperty)
    .get('/user', ReviewController.viewReviewsByUser);

export default router;