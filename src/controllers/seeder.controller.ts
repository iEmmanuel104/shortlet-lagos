import { Request, Response } from 'express';
import SeederService from '../services/seeder.service';
import { NODE_ENV } from '../utils/constants';

export default class SeederController {
    static async seedDatabase(req: Request, res: Response) {
        if (NODE_ENV === 'production') {
            return res.status(403).json({
                status: 'error',
                message: 'Seeding is not allowed in production environment',
            });
        }
        await SeederService.seedDatabase();

        res.status(200).json({
            status: 'success',
            message: 'Database seeded successfully',
        });
    }
}