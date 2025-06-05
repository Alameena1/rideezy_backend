import axios from 'axios';
import polyline from '@mapbox/polyline';

export interface RouteResponse {
  distance: number; // in kilometers
  duration: number; // in minutes
  geometry: string; // Polyline for frontend
  coordinates: [number, number][]; // Required field, no longer optional
}

export class OSRMClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl || 'http://router.project-osrm.org';
  }

  async getRoute(waypoints: string[]): Promise<RouteResponse> {
    if (!waypoints || waypoints.length < 2) {
      throw new Error('At least two waypoints are required');
    }

    const parsedWaypoints: [number, number][] = waypoints.map((wp) => {
      const coords = wp.split(',').map(Number);
      if (coords.length !== 2 || coords.some(isNaN)) {
        throw new Error(`Invalid waypoint format: ${wp}. Expected format: "lat,lng"`);
      }
      return coords as [number, number];
    });

    if (waypoints[0] === waypoints[waypoints.length - 1]) {
      throw new Error('Start and end waypoints cannot be the same');
    }

    console.log(`OSRM Request Waypoints: ${waypoints}`);

    try {
      const coordinates = waypoints.join(';');
      const url = `${this.baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=polyline&steps=true`;
      console.log(`OSRM Request URL: ${url}`);
      const response = await axios.get(url);
      console.log(`OSRM Response: ${JSON.stringify(response.data)}`);

      if (response.data.code !== 'Ok' || !response.data.routes || response.data.routes.length === 0) {
        throw new Error(`Invalid OSRM Response: ${JSON.stringify(response.data)}`);
      }

      const route = response.data.routes[0];
      const decodedCoordinates = polyline.decode(route.geometry) as [number, number][];
      if (!decodedCoordinates || decodedCoordinates.length < 2) {
        throw new Error('Invalid route: too few coordinates after decoding');
      }

      const geoJsonGeometry = JSON.stringify({
        type: 'LineString',
        coordinates: decodedCoordinates.map(([lat, lng]) => [lng, lat]),
      });

      return {
        distance: route.distance / 1000,
        duration: route.duration / 60,
        geometry: geoJsonGeometry,
        coordinates: decodedCoordinates,
      };
    } catch (error: any) {
      console.error('Failed to fetch route from OSRM:', {
        message: error.message || 'Unknown error',
        code: error.code || 'N/A',
        response: error.response?.data || 'No response data',
        status: error.response?.status || 'No status',
        waypoints,
      });
      throw new Error(`OSRM fetch failed: ${error.message || 'Unknown error'}`);
    }
  }

  async findNearestPointOnRoute(
    routeCoordinates: [number, number][],
    userLocation: [number, number]
  ): Promise<[number, number]> {
    if (!routeCoordinates || routeCoordinates.length === 0) {
      throw new Error('Invalid route coordinates');
    }

    const [lat, lng] = userLocation;
    const url = `${this.baseUrl}/nearest/v1/driving/${lng},${lat}`;

    try {
      const response = await axios.get(url);
      console.log(`OSRM Nearest Response for ${userLocation}: ${JSON.stringify(response.data)}`);
      if (response.data.code !== 'Ok' || !response.data.waypoints) {
        throw new Error('Failed to find nearest point on route');
      }

      const nearest = response.data.waypoints[0].location; // [lng, lat]
      return [nearest[1], nearest[0]]; // Convert to [lat, lng]
    } catch (error: any) {
      console.error('Error finding nearest point via OSRM:', {
        message: error.message || 'Unknown error',
        code: error.code || 'N/A',
        response: error.response?.data || 'No response data',
        status: error.response?.status || 'No status',
      });
      let nearestPoint: [number, number] = routeCoordinates[0];
      let minDistance = this.haversineDistance(routeCoordinates[0], userLocation);

      for (const coord of routeCoordinates) {
        const distance = this.haversineDistance(coord, userLocation);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = coord;
        }
      }

      return nearestPoint;
    }
  }

  public haversineDistance(coord1: [number, number], coord2: [number, number]): number {
    const [lat1, lon1] = coord1;
    const [lat2, lon2] = coord2;

    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}