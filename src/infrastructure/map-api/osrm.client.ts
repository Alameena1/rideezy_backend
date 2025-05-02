import axios from 'axios';

export interface RouteResponse {
  distance: number; // in kilometers
  duration: number; // in minutes
  geometry: string; // Polyline for frontend
}

export class OSRMClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl || 'http://router.project-osrm.org';
  }

  async getRoute(startPoint: string, endPoint: string): Promise<RouteResponse> {
    try {
      const [startLat, startLng] = startPoint.split(',').map(Number);
      const [endLat, endLng] = endPoint.split(',').map(Number);
      const url = `${this.baseUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline`;

      const response = await axios.get(url);
      const route = response.data.routes[0];

      return {
        distance: route.distance / 1000, // Convert meters to km
        duration: route.duration / 60, // Convert seconds to minutes
        geometry: route.geometry,
      };
    } catch (error: any) { // Type 'error' as 'any' to allow access to 'message'
      throw new Error(`Failed to fetch route: ${error.message}`);
    }
  }
}