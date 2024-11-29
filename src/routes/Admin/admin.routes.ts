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
router.get('/investment-overview', AdminController.getInvestmentsOverview);
router.get('/metrics/overall', adminAuth('admin'), AdminAuthenticatedController(AdminController.getOverallMetrics));
router.get('/metrics/time-based', adminAuth('admin'), AdminAuthenticatedController(AdminController.getTimeBasedMetrics));

export default router;
