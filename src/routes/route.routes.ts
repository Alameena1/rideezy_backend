import express, { Request, Response } from 'express';

const router = express.Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { startPoint, endPoint } = req.body;

  // Validate input
  if (!startPoint || !endPoint) {
    res.status(400).json({ error: 'startPoint and endPoint are required' });
    return;
  }

  const [startLng, startLat] = startPoint.split(',').map(Number);
  const [endLng, endLat] = endPoint.split(',').map(Number);

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
    res.status(400).json({ error: 'Invalid coordinate format' });
    return;
  }

  try {
    const osrmUrl = process.env.OSRM_URL || 'http://localhost:5000';
    const response = await fetch(
      `${osrmUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
    );
    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      res.json(data.routes[0]);
    } else {
      res.status(400).json({ error: 'No route found' });
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: 'Routing error', details: error.message });
    } else {
      res.status(500).json({ error: 'Routing error', details: 'Unknown error occurred' });
    }
  }
});

export default router;