export interface JoinedRideDto {
  _id: string;
  rideId: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  date: string;
  time: string;
  startPoint: string;
  endPoint: string;
  distanceKm: number;
  mileage: number;
  fuelPrice: number;
  passengerCount: number;
  totalFuelCost: number;
  platformFee: number;
  totalRideCost: number;
  costPerPerson: number;
  totalPeople: number;
  passengers: { passengerId: string; passengerName: string }[];
  status: string;
  routeGeometry?: string;
  pickupPoints: { passengerId: string; location: string; placeName: string }[];
  dropoffPoints: { passengerId: string; location: string; placeName: string }[];
  routeCoordinates: [number, number][];
  paymentStatus: string;
}