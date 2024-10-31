import express, { Router } from 'express';
import SeederController from '../../controllers/seeder.controller';

const router: Router = express.Router();

router
    .get('/', SeederController.seedDatabase);


export default router;