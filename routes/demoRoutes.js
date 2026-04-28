import express from "express";
import { createDemo, getAllDemos } from "../controllers/demoController.js";

const router = express.Router();

// POST → Book Demo
router.post("/bookdemo", createDemo);

// GET → Admin fetch
router.get("/bookdemo", getAllDemos);

export default router;