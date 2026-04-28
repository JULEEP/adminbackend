import express from 'express';
import {
  addClient,
  getAllClients,
  updateClient,
  deleteClient,
  clientLogin,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  updateClientStatusSimple,
  createPackage,
  getAllPackages,
  getPackageById,
  updatePackage,
  deletePackage,
  updatePackageStatus,
  getPackagesByDuration,
  getActivePackages,
  getAllOrders,
  getSingleClient,
  createPlan,
  getAllPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  updatePlanStatus,
  bookPlan
} from '../controllers/clientController.js';

import { uploadClientDoc } from '../config/uploadClientDoc.js'

const router = express.Router();

// IMPORTANT: Use express.json() and express.urlencoded() for FormData
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Add client with document upload
router.post('/addclient', addClient);

router.post('/bookplan', bookPlan);


// Get all clients
router.get('/allclient', getAllClients);
router.get('/singleclient/:id', getSingleClient);
// Update client with optional document upload
router.put(
  '/updateclient/:clientId',
  uploadClientDoc.fields([
    { name: 'aadhaarCard', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
  ]),
  updateClient
);

// Delete client
router.delete('/deleteclient/:clientId', deleteClient);

router.put('/updateclientsstatus/:clientId',  updateClientStatusSimple);


router.post('/clientlogin', clientLogin);

router.get('/products', getAllProducts);

router.post('/createproduct', createProduct);
router.put('/updateproduct/:id', updateProduct);
router.delete('/deleteproduct/:id', deleteProduct);



// Protected routes (all require authentication)
router.post('/createpackage', createPackage);
router.get('/allpackages', getAllPackages);
router.get('/getpackage/:id', getPackageById);
router.put('/updatepackage/:id', updatePackage);
router.delete('/deletepackage/:id', deletePackage);
router.put('/updatepackagestatus/:id', updatePackageStatus);
router.get('/duration/:duration', getPackagesByDuration);
router.get('/active', getActivePackages);


router.get('/allorders', getAllOrders);


// Protected routes (Admin only)
router.post('/createplan',  createPlan);
router.get('/allplans', getAllPlans);
router.get('/plan/:id', getPlanById);
router.put('/updateplan/:id', updatePlan);
router.delete('/deleteplan/:id', deletePlan);
router.put('/updateplanstatus/:id', updatePlanStatus);


export default router;
