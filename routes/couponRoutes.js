import express from 'express';
import {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  deleteCoupon,
  updateCouponStatus,
} from '../controllers/couponController.js';

const router = express.Router();



// Admin only routes
router.post('/createcoupon', createCoupon);
router.get('/allcoupons', getAllCoupons);
router.put('/updatecoupon/:id', updateCoupon);
router.delete('/deletecoupon/:id', deleteCoupon);
router.put('/updatecouponstatus/:id', updateCouponStatus);

export default router;