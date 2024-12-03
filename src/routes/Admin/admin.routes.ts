import express, { Router } from 'express';
import AdminController from '../../controllers/Admin/admin.controller';
import { AdminAuthenticatedController, adminAuth } from '../../middlewares/authMiddleware';

const router: Router = express.Router();

router.post('/login', AdminController.loginSuperAdmin);
router.post('/verify', AdminController.verifySuperAdminLogin);
router.post('/create', adminAuth('admin'), AdminAuthenticatedController(AdminController.createAdmin));
router.get('/admins', adminAuth('admin'), AdminAuthenticatedController(AdminController.getAllAdmins));
router.delete('/delete', adminAuth('admin'), AdminAuthenticatedController(AdminController.deleteAdmin));
router.post('/block-user', adminAuth('admin'), AdminAuthenticatedController(AdminController.blockUser));
router.post('/deactivate-user', adminAuth('admin'), AdminAuthenticatedController(AdminController.deactivateUser));
router.post('/property/:id/review', adminAuth('admin'), AdminAuthenticatedController(AdminController.reviewProperty));
router.get('/investment-overview', AdminController.getInvestmentsOverview);
router.get('/metrics/overall', AdminController.getOverallMetrics);
router.get('/metrics/time-based', AdminController.getTimeBasedMetrics);
router.get('/properties/top-performing', AdminController.getTopPerformingProperties);
router.get('/properties/:propertyId/metrics', AdminController.getDetailedPropertyMetrics);

export default router;
