import express from 'express';
import {
  addClient,
  getAllClients,
  updateClient,
  deleteClient,
  clientLogin,
} from '../controllers/clientController.js';

import { uploadClientDoc } from '../config/uploadClientDoc.js'

const router = express.Router();

// Add client with document upload
router.post(
  '/addclient',
  uploadClientDoc.fields([
    { name: 'aadhaarCard', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
  ]),
  addClient
);

// Get all clients
router.get('/allclient', getAllClients);

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

router.post('/clientlogin', clientLogin);

export default router;
