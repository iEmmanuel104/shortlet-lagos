import express, { Router } from 'express';
import PropertyController from '../controllers/property.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router
    .get('/', PropertyController.getAllProperties)
    .get('/:id', PropertyController.getPropertyById)
    .post('/', basicAuth(), AuthenticatedController(PropertyController.addProperty))
    .patch('/:id', basicAuth(), AuthenticatedController(PropertyController.updateProperty))
    .get('/owner/stats', basicAuth(), AuthenticatedController(PropertyController.getOwnerStats))
    .delete('/:id', basicAuth(), AuthenticatedController(PropertyController.deleteProperty));

export default router;