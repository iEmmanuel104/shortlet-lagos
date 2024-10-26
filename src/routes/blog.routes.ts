
// blog.routes.ts
import express, { Router } from 'express';
import BlogController from '../controllers/blog.controller';
import { AuthenticatedController, basicAuth } from '../middlewares/authMiddleware';
import { uploadMiddleware, UploadType } from '../middlewares/uploadMiddleware';

const router: Router = express.Router();

const propertyUploadFields = [
    { name: 'images', maxCount: 5 },
    { name: 'documents', maxCount: 1 },
];

const upload = uploadMiddleware(UploadType.Fields, propertyUploadFields);

router.route('/')
    .get(BlogController.getAllBlogs)
    .post(
        basicAuth(),
        upload,
        AuthenticatedController(BlogController.createBlog)
    );

router.route('/')
    .patch(
        basicAuth(),
        upload,
        AuthenticatedController(BlogController.updateBlog)
    )
    .delete(basicAuth(), AuthenticatedController(BlogController.deleteBlog));

router.get('/info', BlogController.getBlog);    
router.post('/engage', basicAuth(), AuthenticatedController(BlogController.engageWithBlog));
router.delete('/blog-comment', basicAuth(), AuthenticatedController(BlogController.deleteActivityComment));
router.get('/activities', BlogController.getBlogActivities);

export default router;