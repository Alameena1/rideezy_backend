import { inject, injectable } from "inversify";
import { TYPES } from "../../di/types";
import { IInitiateRideService } from "../interfaces/ride/iinitiate-ride.service";
import { ISubscriptionService } from "../interfaces/subscription/isubscriptionService";
import { IUserRepository } from "../../repositories/interface/user/iuserRepository";
import { IVehicleRepository } from "../../repositories/interface/vehicle/ivehicleRepository";
import { IInitiateRideRepository } from "../../repositories/interface/ride/iinitiate-ride-repository";
import { IOSRMClient } from "../../infrastructure/map-api/osrm.client";
import { CreateRideDto } from "../../dtos/create-ride.dto";
import { IRide, RideCreationData } from "../../models/ride.model";
import { EditRideDto } from "../../dtos/edit-ride.dto";
import { INotificationService } from "../interfaces/notification/iNotificationService";
import { ITrackingService } from "../interfaces/tracking/itrackingService";
import { Types } from "mongoose";

@injectable()
export class InitiateRideService implements IInitiateRideService {
  constructor(
    @inject(TYPES.IUserRepository) private _userRepo: IUserRepository,
    @inject(TYPES.IVehicleRepository) private _vehicleRepo: IVehicleRepository,
    @inject(TYPES.IInitiateRideRepository) private _rideRepo: IInitiateRideRepository,
    @inject(TYPES.ISubscriptionService) private _subscriptionService: ISubscriptionService,
    @inject(TYPES.IOSRMClient) private _osrmClient: IOSRMClient,
    @inject(TYPES.INotificationService) private _notificationService: INotificationService,
    @inject(TYPES.ITrackingService) private _trackingService: ITrackingService
  ) {}

   async startRide(dto: CreateRideDto): Promise<IRide> {
      const _session = await this._userRepo.startSession();
      try {
        const _result = await _session.withTransaction(async () => {
          const _driver = await this._userRepo.findUserById(dto.driverId!, { session: _session });
          if (!_driver) throw new Error("Driver not found");
          if (_driver.govId?.verificationStatus !== "Verified")
            throw new Error("Driver must be verified");
  
          const _canStart = await this._subscriptionService.canStartRide(dto.driverId!);
          if (!_canStart) {
            const { startRides } = await this._subscriptionService.getRemainingRideCounts(dto.driverId!);
            if (startRides === 0) {
              throw new Error("Ride start limit exceeded. Please upgrade your subscription to start more rides.");
            } else {
              throw new Error(`Ride start limit exceeded. Remaining starts: ${startRides}`);
            }
          }
  
          const _vehicle = await this._vehicleRepo.findById(dto.vehicleId, { session: _session });
          console.log("qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",_vehicle?.status)
          if (!_vehicle) throw new Error("Vehicle not found");
          if (_vehicle.user.toString() !== dto.driverId)
            throw new Error("Vehicle mismatch");
          if (_vehicle.status !== "Approved")
            throw new Error("Vehicle not approved");
          if (dto.passengerCount > _vehicle.seatCapacity) {
            throw new Error(`Passenger count (${dto.passengerCount}) exceeds vehicle seat capacity (${_vehicle.seatCapacity})`);
          }
  
          if (dto.startPoint === dto.endPoint)
            throw new Error("Start and end points cannot be the same");
  
          const _newRideDate = new Date(dto.date);
          const _newRideTime = dto.time.split(':').map(Number);
          const _newRideStart = new Date(_newRideDate.getFullYear(), _newRideDate.getMonth(), _newRideDate.getDate(), _newRideTime[0], _newRideTime[1]);
          const _averageSpeedKmh = 50;
          const _bufferMinutes = 30;
          const _estimatedDurationHours = dto.distance / _averageSpeedKmh;
          const _estimatedEndTime = new Date(_newRideStart.getTime() + _estimatedDurationHours * 60 * 60 * 1000 + _bufferMinutes * 60 * 1000);
  
          const _existingRides = await this._rideRepo.find({
            driverId: dto.driverId,
            date: new Date(dto.date),
            status: { $in: ["Pending", "Started"] },
          });
  
          for (const _existingRide of _existingRides) {
            const _existingTime = _existingRide.time.split(':').map(Number);
            const _existingStart = new Date(_existingRide.date.getFullYear(), _existingRide.date.getMonth(), _existingRide.date.getDate(), _existingTime[0], _existingTime[1]);
            const _existingEstimatedDurationHours = _existingRide.distanceKm / _averageSpeedKmh;
            const _existingEnd = new Date(_existingStart.getTime() + _existingEstimatedDurationHours * 60 * 60 * 1000 + _bufferMinutes * 60 * 1000);
  
            if (
              (_newRideStart >= _existingStart && _newRideStart < _existingEnd) ||
              (_existingStart >= _newRideStart && _existingStart < _estimatedEndTime)
            ) {
              throw new Error("You have a conflicting ride scheduled around this time. Please choose a different time.");
            }
          }
  
          const _driverName = _driver.fullName;
          const _route = await this._osrmClient.getRoute(
            [dto.startPoint, dto.endPoint],
            dto.routeGeometry
          );
          const _routeCoordinates = _route.coordinates;
  
          if (_routeCoordinates.length < 2)
            throw new Error("Invalid route coordinates");
  
          const [_startLat, _startLng] = dto.startPoint.split(",").map(Number);
          const [_endLat, _endLng] = dto.endPoint.split(",").map(Number);
          const _startPlaceName = await this._osrmClient.reverseGeocode(
            _startLat,
            _startLng
          );
          const _endPlaceName = await this._osrmClient.reverseGeocode(
            _endLat,
            _endLng
          );
  
          const _distanceKm = dto.distance;
          const _fuelNeeded = _distanceKm / _vehicle.mileage;
          const _totalFuelCost = _fuelNeeded * dto.fuelPrice;
          let _platformFee = dto.platformFee || 0;
  
          const _isSubscribed = await this._subscriptionService.hasActiveSubscription(dto.driverId!);
          if (!_isSubscribed) {
            _platformFee = Math.ceil(_totalFuelCost * 0.1);
            if (!_driver.wallet)
              throw new Error(
                "Driver's wallet is not initialized. Please contact support."
              );
            if (_driver.wallet.balance < _platformFee)
              throw new Error(
                `Insufficient wallet balance. Please add ₹${
                  _platformFee - _driver.wallet.balance
                } to your wallet.`
              );
            _driver.wallet.balance -= _platformFee;
            _driver.wallet.transactions.push({
              transactionId: `TXN_${Date.now()}`,
              type: "WITHDRAWAL",
              amount: _platformFee,
              status: "COMPLETED",
              createdAt: new Date(),
            });
            await this._userRepo.updateOne(
              { _id: _driver._id },
              { $set: { wallet: _driver.wallet } },
              { session: _session }
            );
          }
  
          const _totalRideCost = _totalFuelCost + _platformFee;
          const _perKmRate = _totalRideCost / _distanceKm;
  
          let _rideId: string;
          let _existingRide: IRide | null;
          do {
            _rideId = `RIDE_${Date.now()}`;
            _existingRide = await this._rideRepo.findOne({ rideId: _rideId }, { session: _session });
          } while (_existingRide);
  
          console.log(
            `[${new Date().toISOString()}] Calculated perKmRate for ride ${_rideId}:`,
            { _totalRideCost, _distanceKm, _perKmRate }
          );
  
          const _rideData: RideCreationData = {
            rideId: _rideId,
            driverId: dto.driverId!,
            driverName: _driverName,
            vehicleId: dto.vehicleId,
            date: new Date(dto.date),
            time: dto.time,
            startPoint: dto.startPoint,
            startPlaceName: dto.startPlaceName || _startPlaceName,
            endPoint: dto.endPoint,
            endPlaceName: dto.endPlaceName || _endPlaceName, 
            distanceKm: _distanceKm,
            mileage: _vehicle.mileage,
            fuelPrice: dto.fuelPrice,
            passengerCount: dto.passengerCount,
            totalFuelCost: _totalFuelCost,
            platformFee: _platformFee,
            totalRideCost: _totalRideCost,
            perKmRate: _perKmRate,
            passengers: [],
            status: "Pending",
            routeGeometry: _route.geometry,
            pickupPoints: [],
            dropoffPoints: [],
            routeCoordinates: _routeCoordinates,
            passengerDistances: [],
            passengerCosts: [],
          };
  
          const _createdRide = await this._rideRepo.createRide(_rideData, { session: _session });
  
          await this._subscriptionService.decrementStartRideCount(dto.driverId!);
  
          const _startMessage = `You have initiated ride ${_rideId}. Start: ${dto.startPlaceName || _startPlaceName}, End: ${dto.endPlaceName || _endPlaceName}, Date: ${dto.date} ${dto.time}`;
          await this._notificationService.triggerRideCancellationNotification(
            _rideId,
            dto.driverId!,
            _startMessage
          );
  
          return _createdRide;
        });
        return _result!;
      } catch (_error) {
        console.error(
          `[RideService] Error starting ride: ${(_error as Error).message}`
        );
        throw _error;
      } finally {
        _session.endSession();
      }
    }

  async editRide(
    rideId: string,
    driverId: string,
    dto: EditRideDto
  ): Promise<IRide> {
    const _ride = await this._rideRepo.findOne({ rideId });
    if (!_ride) throw new Error("Ride not found");
    if (_ride.driverId !== driverId) throw new Error("Unauthorized");

    if (
      _ride.status !== "Pending" &&
      (!dto.status || dto.status !== "Started")
    ) {
      throw new Error("Only Pending rides editable or can be started");
    }

    const _newDateTime =
      dto.date && dto.time ? new Date(`${dto.date}T${dto.time}:00`) : undefined;
    if (_newDateTime && _newDateTime <= new Date() && !dto.status) {
      throw new Error("Future date required for date/time changes");
    }

    await this._rideRepo.updateOne(
      { rideId },
      {
        date: dto.date ? new Date(dto.date) : _ride.date,
        time: dto.time || _ride.time,
        status: dto.status || _ride.status,
      }
    );

    const _updatedRide = await this._rideRepo.findOne({ rideId })!;
    if (_updatedRide) {
      const _message = `Ride ${rideId} has been updated. New date: ${dto.date || _ride.date.toISOString().split('T')[0]}, New time: ${dto.time || _ride.time}, Status: ${dto.status || _ride.status}`;
      for (const _passenger of _updatedRide.passengers) {
        await this._notificationService.triggerRideCancellationNotification(
          rideId,
          _passenger.passengerId,
          _message
        );
      }
    }

    return _updatedRide!;
  }

  async cancelRide(rideId: string, driverId: string): Promise<void> {
    const _session = await this._rideRepo.startSession();
    try {
      await _session.withTransaction(async () => {
        const _ride = await this._rideRepo.findOne({ rideId }, { session: _session });
        if (!_ride) throw new Error("Ride not found");
        if (_ride.driverId !== driverId) throw new Error("Unauthorized");
        if (_ride.status !== "Pending")
          throw new Error("Only Pending rides cancellable");

        const _driver = await this._userRepo.findUserById(_ride.driverId, {
          session: _session,
        });
        if (!_driver) throw new Error("Driver not found");
        if (!_driver.wallet)
          throw new Error(
            "Driver's wallet is not initialized. Please contact support."
          );

        const _totalRefund = _ride.passengerCosts.reduce((_sum, _pc) => _sum + _pc.cost, 0);
        if (_driver.wallet.balance < _totalRefund) {
          throw new Error(
            `Driver's wallet has insufficient balance for refund. Please contact support.`
          );
        }

        for (const _passenger of _ride.passengers) {
          const _passengerData = await this._userRepo.findUserById(
            _passenger.passengerId,
            { session: _session }
          );
          if (!_passengerData) {
            console.error(
              `[${new Date().toISOString()}] Passenger not found: ${_passenger.passengerId}`
            );
            continue;
          }
          if (!_passengerData.wallet) {
            console.error(
              `[${new Date().toISOString()}] Passenger wallet not initialized: ${_passenger.passengerId}`
            );
            continue;
          }
          const _passengerCost = _ride.passengerCosts.find((_pc) => _pc.passengerId === _passenger.passengerId)?.cost || 0;
          _passengerData.wallet.balance += _passengerCost;
          _passengerData.wallet.transactions.push({
            transactionId: `TXN_${Date.now()}`,
            type: "REFUND",
            amount: _passengerCost,
            status: "COMPLETED",
            createdAt: new Date(),
          });
          await this._userRepo.updateOne(
            { _id: _passengerData._id },
            { $set: { wallet: _passengerData.wallet } },
            { session: _session }
          );

          await this._notificationService.triggerRideCancellationNotification(
            rideId,
            _passenger.passengerId,
            `Ride ${rideId} has been cancelled by the driver. Refund of ${_passengerCost} credited to your wallet.`
          );
        }

        _driver.wallet.balance -= _totalRefund;
        _driver.wallet.transactions.push({
          transactionId: `TXN_${Date.now()}`,
          type: "WITHDRAWAL",
          amount: _totalRefund,
          status: "COMPLETED",
          createdAt: new Date(),
        });
        await this._userRepo.updateOne(
          { _id: _driver._id },
          { $set: { wallet: _driver.wallet } },
          { session: _session }
        );

        await this._rideRepo.updateOne(
          { rideId },
          { status: "Cancelled" },
          { session: _session }
        );
      });
    } catch (_error) {
      console.error(
        `[RideService] Error cancelling ride ${rideId}: ${(_error as Error).message}`
      );
      throw _error;
    } finally {
      _session.endSession();
    }
  }

 async getRides(userId: string): Promise<IRide[]> {
    const _rides = await this._rideRepo.find({ driverId: userId });
    const _sortedRides = _rides.sort((_a, _b) => new Date(_b.createdAt).getTime() - new Date(_a.createdAt).getTime());
    console.log("Sorted rides:", _sortedRides);
    return _sortedRides;
  }

   async findById(rideId: string): Promise<IRide | null> {
      try {
        console.log("[RideService] Finding ride by _id:", rideId);
        if (!Types.ObjectId.isValid(rideId)) {
          console.warn(`[RideService] Invalid ObjectId: ${rideId}`);
          return null;
        }
        const _ride = await this._rideRepo.findOne({
          _id: new Types.ObjectId(rideId),
        });
        if (!_ride) {
          console.warn(`[RideService] No ride found for _id: ${rideId}`);
          return null;
        }
        console.log("[RideService] Found ride:", _ride);
        return _ride;
      } catch (_error) {
        console.error(
          `[RideService] Error fetching ride with _id ${rideId}:`,
          (_error as Error).message
        );
        throw new Error(`Failed to fetch ride: ${(_error as Error).message}`);
      }
    }

  async startTracking(rideId: string, driverId: string): Promise<IRide> {
    const _session = await this._rideRepo.startSession();
    try {
      const _result = await _session.withTransaction(async () => {
        const _ride = await this._rideRepo.findOne({ rideId }, { session: _session });
        if (!_ride) {
          console.error("[RideService] No ride found in database for rideId:", rideId);
          throw new Error("Ride not found");
        }
        if (_ride.driverId !== driverId) throw new Error("Unauthorized");
        if (_ride.status !== "Pending") throw new Error("Only Pending rides can be started");

        const _rideDateTime = new Date(`${_ride.date.toISOString().split("T")[0]}T${_ride.time}:00`);
        if (new Date() < _rideDateTime) {
          console.warn("Starting tracking before scheduled time");
        }

        await this._rideRepo.updateOne({ rideId }, { status: "Started" }, { session: _session });

        // Notify all passengers that the ride has started
        for (const _passenger of _ride.passengers) {
          await this._notificationService.triggerRideCancellationNotification(
            rideId,
            _passenger.passengerId,
            `Ride ${rideId} has started. Get ready for your trip!`
          );
        }

        return (await this._rideRepo.findOne({ rideId }, { session: _session }))!;
      });
      return _result!;
    } catch (_error) {
      console.error(`[RideService] Error starting tracking for ride ${rideId}: ${(_error as Error).message}`);
      throw _error;
    } finally {
      _session.endSession();
    }
  }

async updateRide(rideId: string, driverId: string, updates: { passengerId?: string; action?: "picked" | "dropped"; status?: string; currentPosition?: [number, number] }): Promise<IRide> {
  console.log("[RideService] updateRide called with:", { rideId, driverId, updates });
  
  if (!Types.ObjectId.isValid(rideId)) {
    throw new Error("Invalid ride ID");
  }

  const _session = await this._rideRepo.startSession();
  try {
    const _result = await _session.withTransaction(async () => {
      const _ride = await this._rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session: _session });
      console.log("[RideService] Found ride:", _ride);
      
      if (!_ride) throw new Error("Ride not found");
      if (_ride.driverId !== driverId) throw new Error("Unauthorized");

      // Handle status updates
      if (updates.status) {
        console.log("[RideService] Updating status to:", updates.status);
        await this._rideRepo.updateOne(
          { _id: new Types.ObjectId(rideId) },
          { status: updates.status },
          { session: _session }
        );
      }
      
      // Handle passenger actions (picked/dropped)
      if (updates.action && updates.passengerId) {
        console.log("[RideService] Processing action:", updates.action);
        // Your existing logic for handling passenger actions
        const _passengerIndex = _ride.passengers.findIndex(_p => _p.passengerId === updates.passengerId);
        if (_passengerIndex === -1) throw new Error("Passenger not found");
        
        if (updates.action === "picked") {
          _ride.passengers[_passengerIndex].pickedUp = true;
        } else if (updates.action === "dropped") {
          _ride.passengers[_passengerIndex].droppedOff = true;
        }
        
        await this._rideRepo.updateOne(
          { _id: new Types.ObjectId(rideId) },
          { passengers: _ride.passengers },
          { session: _session }
        );
      }

      const _updatedRide = await this._rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session: _session });
      if (!_updatedRide) throw new Error("Updated ride not found");
      return _updatedRide;
    });
    return _result!;
  } catch (_error) {
    console.error(`[RideService] Error updating ride ${rideId}:`, _error);
    throw _error;
  } finally {
    _session.endSession();
  }
}


async emergencyStopRide(rideId: string, driverId: string, reason: string, currentPosition: [number, number]): Promise<IRide> {
    const _session = await this._rideRepo.startSession();
    try {
      const _result = await _session.withTransaction(async () => {
        const _ride = await this._rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session: _session });
        if (!_ride) throw new Error("Ride not found");
        if (_ride.driverId !== driverId) throw new Error("Unauthorized");
        if (_ride.status !== "Started") throw new Error("Only started rides can be emergency stopped");

        // Calculate distance traveled and remaining distance
        const _totalDistanceTraveled = await this._calculateDistanceTraveled(_ride, currentPosition);
        const _estimatedRemainingDistance = Math.max(0, _ride.distanceKm - _totalDistanceTraveled);
        
        // Calculate refund percentage based on distance traveled
        const _refundPercentage = this._calculateRefundPercentage(_totalDistanceTraveled, _ride.distanceKm);
        
        // Update ride with emergency stop details
        const _emergencyStop = {
          reason,
          stoppedAt: new Date(),
          currentPosition,
          totalDistanceTraveled: _totalDistanceTraveled,
          estimatedRemainingDistance: _estimatedRemainingDistance,
          refundPercentage: _refundPercentage,
        };

        await this._rideRepo.updateOne(
          { _id: new Types.ObjectId(rideId) },
          { 
            status: "EmergencyStopped",
            emergencyStop: _emergencyStop,
            currentPosition,
            totalDistanceTraveled: _totalDistanceTraveled
          },
          { session: _session }
        );

        const _updatedRide = await this._rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session: _session });
        if (!_updatedRide) throw new Error("Updated ride not found");

        // Stop tracking
        try {
          await this._trackingService.stopTracking(rideId);
        } catch (_error) {
          console.warn(`[RideService] Error stopping tracking for emergency stop: ${_error}`);
        }

        // Process refunds and get the total refund amount
        const _totalRefundAmount = await this.processEmergencyRefunds(rideId, _session);

        // Notify all passengers
        for (const _passenger of _updatedRide.passengers) {
          const _refundAmount = _passenger.cost * (_refundPercentage / 100);
          await this._notificationService.triggerRideCancellationNotification(
            rideId,
            _passenger.passengerId,
            `🚨 Ride Emergency Stop: ${reason}. You have received a ${_refundPercentage}% refund (₹${_refundAmount.toFixed(2)}) credited to your wallet.`
          );
        }

        // Notify driver
        await this._notificationService.triggerRideCancellationNotification(
          rideId,
          driverId,
          `Ride emergency stopped: ${reason}. Total refund of ₹${_totalRefundAmount.toFixed(2)} has been deducted from your wallet and credited to passengers.`
        );

        return _updatedRide;
      });
      return _result!;
    } catch (_error) {
      console.error(`[RideService] Error emergency stopping ride ${rideId}:`, _error);
      throw _error;
    } finally {
      _session.endSession();
    }
  }

  async processEmergencyRefunds(rideId: string, session?: any): Promise<number> { 
    const _useExternalSession = !session;
    const _internalSession = _useExternalSession ? await this._rideRepo.startSession() : session;
    
    try {
      if (_useExternalSession) {
        return await _internalSession.withTransaction(async () => {
          return await this._processEmergencyRefunds(rideId, _internalSession);
        });
      } else {
        return await this._processEmergencyRefunds(rideId, _internalSession);
      }
    } finally {
      if (_useExternalSession) {
        _internalSession.endSession();
      }
    }
  }

  private async _processEmergencyRefunds(rideId: string, session: any): Promise<number> { // CHANGE RETURN TYPE TO number
    const _ride = await this._rideRepo.findOne({ _id: new Types.ObjectId(rideId) }, { session });
    if (!_ride || !_ride.emergencyStop) {
      throw new Error("Ride not found or no emergency stop recorded");
    }

    const { refundPercentage: _refundPercentage } = _ride.emergencyStop;

    // First, get the driver's wallet to deduct refunds from
    const _driver = await this._userRepo.findUserById(_ride.driverId, { session });
    if (!_driver || !_driver.wallet) {
      throw new Error("Driver wallet not found");
    }

    let _totalRefundAmount = 0;

    for (const _passenger of _ride.passengers) {
      try {
        const _passengerUser = await this._userRepo.findUserById(_passenger.passengerId, { session });
        if (!_passengerUser || !_passengerUser.wallet) {
          console.error(`[RideService] Passenger wallet not found for: ${_passenger.passengerId}`);
          continue;
        }

        const _refundAmount = _passenger.cost * (_refundPercentage / 100);
        _totalRefundAmount += _refundAmount;

        // 1. Deduct from driver's wallet
        if (_driver.wallet.balance < _refundAmount) {
          console.error(`[RideService] Insufficient balance in driver wallet for refund. Driver: ${_driver.wallet.balance}, Required: ${_refundAmount}`);
          throw new Error(`Insufficient balance in driver wallet for refund processing`);
        }

        _driver.wallet.balance -= _refundAmount;
        _driver.wallet.transactions.push({
          transactionId: `REFUND_DRIVER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: "REFUND_PAYOUT", // NOW THIS WILL WORK
          amount: _refundAmount, // Use positive amount, the type indicates it's a payout
          status: "COMPLETED",
          createdAt: new Date(),
          description: `Emergency ride stop refund to passenger ${_passenger.passengerName} - Ride ${_ride.rideId}`
        });

        // 2. Credit to passenger's wallet
        _passengerUser.wallet.balance += _refundAmount;
        _passengerUser.wallet.transactions.push({
          transactionId: `REFUND_PASSENGER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: "REFUND",
          amount: _refundAmount,
          status: "COMPLETED",
          createdAt: new Date(),
          description: `Emergency ride stop refund - Ride ${_ride.rideId}`
        });

        // Update passenger wallet
        await this._userRepo.updateOne(
          { _id: _passengerUser._id },
          { $set: { wallet: _passengerUser.wallet } },
          { session }
        );

        // Update passenger refund details in ride
        const _passengerIndex = _ride.passengers.findIndex(_p => _p.passengerId === _passenger.passengerId);
        if (_passengerIndex !== -1) {
          _ride.passengers[_passengerIndex].refundAmount = _refundAmount;
          _ride.passengers[_passengerIndex].refundStatus = "processed";
        }

        console.log(`[RideService] Refund processed for passenger ${_passenger.passengerId}: ₹${_refundAmount} (deducted from driver, credited to passenger)`);
      } catch (_error) {
        console.error(`[RideService] Error processing refund for passenger ${_passenger.passengerId}:`, _error);
        
        // Mark refund as failed
        const _passengerIndex = _ride.passengers.findIndex(_p => _p.passengerId === _passenger.passengerId);
        if (_passengerIndex !== -1) {
          _ride.passengers[_passengerIndex].refundStatus = "failed";
        }
      }
    }

    // Update driver's wallet with all deductions
    await this._userRepo.updateOne(
      { _id: _driver._id },
      { $set: { wallet: _driver.wallet } },
      { session }
    );

    // Update ride with refund details
    await this._rideRepo.updateOne(
      { _id: new Types.ObjectId(rideId) },
      { passengers: _ride.passengers },
      { session }
    );

    console.log(`[RideService] Total refund amount processed: ₹${_totalRefundAmount} deducted from driver ${_ride.driverId}`);
    
    return _totalRefundAmount; // RETURN THE TOTAL AMOUNT
  }

  private async _calculateDistanceTraveled(_ride: IRide, _currentPosition: [number, number]): Promise<number> {
    try {
      // Get the route coordinates
      const _routeCoordinates = _ride.routeCoordinates.map(([_lng, _lat]) => [_lat, _lng] as [number, number]);
      
      // Find the nearest point on the route to current position
      let _nearestIndex = 0;
      let _minDistance = Infinity;
      
      for (let _i = 0; _i < _routeCoordinates.length; _i++) {
        const _distance = this._calculateHaversineDistance(_currentPosition, _routeCoordinates[_i]);
        if (_distance < _minDistance) {
          _minDistance = _distance;
          _nearestIndex = _i;
        }
      }

      // Calculate cumulative distance from start to nearest point
      let _totalDistance = 0;
      for (let _i = 1; _i <= _nearestIndex; _i++) {
        const _segmentDistance = this._calculateHaversineDistance(_routeCoordinates[_i-1], _routeCoordinates[_i]);
        _totalDistance += _segmentDistance;
      }

      return _totalDistance;
    } catch (_error) {
      console.error("[RideService] Error calculating distance traveled:", _error);
      // Fallback: estimate based on time if route calculation fails
      const _rideStartTime = new Date(`${_ride.date.toISOString().split('T')[0]}T${_ride.time}:00`);
      const _now = new Date();
      const _hoursElapsed = (_now.getTime() - _rideStartTime.getTime()) / (1000 * 60 * 60);
      const _estimatedDistance = _hoursElapsed * 40; // Assume 40 km/h average speed
      return Math.min(_estimatedDistance, _ride.distanceKm);
    }
  }

  private _calculateRefundPercentage(_distanceTraveled: number, _totalDistance: number): number {
    const _percentageTraveled = (_distanceTraveled / _totalDistance) * 100;
    
    // Refund logic based on distance traveled:
    if (_percentageTraveled <= 25) {
      return 80; // 80% refund if less than 25% traveled
    } else if (_percentageTraveled <= 50) {
      return 60; // 60% refund if 25-50% traveled
    } else if (_percentageTraveled <= 75) {
      return 40; // 40% refund if 50-75% traveled
    } else {
      return 20; // 20% refund if more than 75% traveled
    }
  }

  private _calculateHaversineDistance(_coord1: [number, number], _coord2: [number, number]): number {
    const _R = 6371; // Earth's radius in km
    const _dLat = (_coord2[0] - _coord1[0]) * Math.PI / 180;
    const _dLon = (_coord2[1] - _coord1[1]) * Math.PI / 180;
    const _a = 
      Math.sin(_dLat/2) * Math.sin(_dLat/2) +
      Math.cos(_coord1[0] * Math.PI / 180) * Math.cos(_coord2[0] * Math.PI / 180) * 
      Math.sin(_dLon/2) * Math.sin(_dLon/2);
    const _c = 2 * Math.atan2(Math.sqrt(_a), Math.sqrt(1-_a));
    return _R * _c;
  }


}