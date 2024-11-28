import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import propertyRoutes from './property.routes';
import investmentRoutes from './investment.routes';
import referralRoutes from './referral.routes';
import reviewRoutes from './review.routes';
import verificationRoutes from './verification.routes';
import withdrawalRequestRoutes from './withdrawalRequest.routes';
import blogRoutes from './blog.routes';
import seederRoutes from './Admin/seeder.routes';
import AdminRoutes from './Admin/admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/property', propertyRoutes);
router.use('/investment', investmentRoutes);
router.use('/referral', referralRoutes);
router.use('/review', reviewRoutes);
router.use('/blog', blogRoutes);
router.use('/verification', verificationRoutes);
router.use('/withdrawal-request', withdrawalRequestRoutes);
router.use('/admin/seed', seederRoutes);  
router.use('/iamshortlet', AdminRoutes);

export default router;