import express, { Request, Response } from 'express';

const router = express.Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { startPoint, endPoint } = req.body;

  // Validate input
  if (!startPoint || !endPoint) {
    res.status(400).json({ error: 'startPoint and endPoint are required' });
    return;
  }

  // Parse coordinates - handle both formats
  const [startLat, startLng] = startPoint.split(',').map(Number);
  const [endLat, endLng] = endPoint.split(',').map(Number);

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
    res.status(400).json({ error: 'Invalid coordinate format' });
    return;
  }

  console.log('Received coordinates:', {
    startPoint,
    endPoint,
    parsed: { startLat, startLng, endLat, endLng }
  });

  try {
    // OSRM expects longitude,latitude order
    const osrmUrl = 'https://router.project-osrm.org';
    const url = `${osrmUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    
    console.log('OSRM Request URL:', url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('OSRM Response:', {
      code: data.code,
      distance: data.routes?.[0]?.distance,
      waypoints: data.waypoints?.map((w: any) => ({ distance: w.distance, location: w.location }))
    });

    if (data.code === 'Ok' && data.routes && data.routes.length > 0 && data.routes[0].distance > 0) {
      res.json(data.routes[0]);
    } else {
      // If OSRM fails, calculate a straight-line route as fallback
      console.log('OSRM returned invalid route, using fallback calculation');
      const fallbackRoute = createFallbackRoute(startLng, startLat, endLng, endLat);
      res.json(fallbackRoute);
    }
  } catch (error) {
    console.error('Routing error:', error);
    // Fallback to straight-line route
    const fallbackRoute = createFallbackRoute(startLng, startLat, endLng, endLat);
    res.json(fallbackRoute);
  }
});

// Fallback route calculation (straight line)
function createFallbackRoute(startLng: number, startLat: number, endLng: number, endLat: number) {
  const distance = calculateHaversineDistance(startLat, startLng, endLat, endLng);
  const duration = distance / 50 * 3600; // Assume 50 km/h speed
  
  return {
    distance: distance,
    duration: duration,
    geometry: {
      type: "LineString",
      coordinates: [[startLng, startLat], [endLng, endLat]]
    },
    legs: [{
      distance: distance,
      duration: duration,
      steps: []
    }],
    weight_name: "routability",
    weight: duration
  };
}

// Haversine distance calculation in meters
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default router;