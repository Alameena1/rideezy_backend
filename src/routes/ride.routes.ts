import { Router } from 'express';
import container from '../di/container';
import { TYPES } from '../di/types';
import { IRideController } from '../controllers/interface/ride/irideController';
import authMiddleware from '../middlewares/auth.middleware';

const router = Router();
const rideController = container.get<IRideController>(TYPES.IRideController);

router.post('/start', authMiddleware, rideController.startRide.bind(rideController));
router.post('/join', authMiddleware, rideController.joinRide.bind(rideController));
router.get('/rides', authMiddleware, rideController.getRides.bind(rideController)); 

export default router;