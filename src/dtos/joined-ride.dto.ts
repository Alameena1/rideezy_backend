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
  costPerPerson: number;
  totalPeople: number;
  passengers: { passengerId: string; passengerName: string }[];
  pickupPoints: { passengerId: string; location: string; placeName: string }[];
  dropoffPoints: { passengerId: string; location: string; placeName: string }[];
  status: string;
  routeGeometry: string;
  paymentStatus?: string; // Add paymentStatus
}