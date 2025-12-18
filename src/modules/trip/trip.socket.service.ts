import { IoSocket } from '../../app';
import Trip from './trip.model';
import User from '../user/user.model';

/**
 * Emit trip created notification to relevant users
 */
export const emitTripCreated = async (tripId: string, driverId: string) => {
  try {
    console.log('🚗 [SOCKET] Emitting trip created event:', { tripId, driverId });

    if (!IoSocket) {
      console.log('❌ [SOCKET] Socket.IO not available for trip created event');
      return;
    }

    // Get populated trip
    const trip = await Trip.findById(tripId)
      .populate('driverId', 'firstName lastName email image socketId')
      .lean();

    if (!trip) {
      console.log('❌ [SOCKET] Trip not found:', tripId);
      return;
    }

    const notification = {
      eventType: 'tripCreated',
      tripId,
      trip,
      driverId,
      createdAt: new Date(),
    };

    // Emit to driver's personal room
    IoSocket.to(`user-${driverId}`).emit('tripNotification', notification);
    console.log(`✅ [SOCKET] Trip created notification sent to driver ${driverId}`);

    // Emit to trip room for future subscribers
    IoSocket.to(`trip-${tripId}`).emit('tripNotification', notification);
    console.log(`✅ [SOCKET] Trip created notification sent to trip room ${tripId}`);

    // Broadcast to all users (for trip discovery)
    IoSocket.emit('tripCreated', notification);
    console.log(`✅ [SOCKET] Trip created broadcast sent to all users`);
  } catch (error) {
    console.error('❌ [SOCKET] Error emitting trip created event:', error);
  }
};

/**
 * Emit trip updated notification
 */
export const emitTripUpdated = async (tripId: string, driverId: string, updateData?: any) => {
  try {
    console.log('🔄 [SOCKET] Emitting trip updated event:', { tripId, driverId });

    if (!IoSocket) {
      console.log('❌ [SOCKET] Socket.IO not available for trip updated event');
      return;
    }

    // Get populated trip
    const trip = await Trip.findById(tripId)
      .populate('driverId', 'firstName lastName email image socketId')
      .populate('passengers.userId', 'firstName lastName email image socketId')
      .lean();

    if (!trip) {
      console.log('❌ [SOCKET] Trip not found:', tripId);
      return;
    }

    const notification = {
      eventType: 'tripUpdated',
      tripId,
      trip,
      driverId,
      updateData,
      updatedAt: new Date(),
    };

    // Emit to driver's personal room
    IoSocket.to(`user-${driverId}`).emit('tripNotification', notification);
    console.log(`✅ [SOCKET] Trip updated notification sent to driver ${driverId}`);

    // Emit to trip room (for passengers and other subscribers)
    IoSocket.to(`trip-${tripId}`).emit('tripNotification', notification);
    console.log(`✅ [SOCKET] Trip updated notification sent to trip room ${tripId}`);

    // Emit to all passengers
    const passengers = (trip.passengers as any[]) || [];
    passengers.forEach((passenger: any) => {
      if (passenger.userId && passenger.status !== 'cancelled') {
        const passengerId = passenger.userId._id || passenger.userId;
        IoSocket.to(`user-${passengerId}`).emit('tripNotification', notification);
        console.log(`✅ [SOCKET] Trip updated notification sent to passenger ${passengerId}`);
      }
    });

    // Broadcast to all users (for trip discovery updates)
    IoSocket.emit('tripUpdated', notification);
    console.log(`✅ [SOCKET] Trip updated broadcast sent to all users`);
  } catch (error) {
    console.error('❌ [SOCKET] Error emitting trip updated event:', error);
  }
};

/**
 * Emit booking created notification
 */
export const emitBookingCreated = async (tripId: string, passengerId: string, bookingData?: any) => {
  try {
    console.log('🎫 [SOCKET] Emitting booking created event:', { tripId, passengerId });

    if (!IoSocket) {
      console.log('❌ [SOCKET] Socket.IO not available for booking created event');
      return;
    }

    // Get populated trip
    const trip = await Trip.findById(tripId)
      .populate('driverId', 'firstName lastName email image socketId')
      .populate('passengers.userId', 'firstName lastName email image socketId')
      .lean();

    if (!trip) {
      console.log('❌ [SOCKET] Trip not found:', tripId);
      return;
    }

    const driverId = (trip.driverId as any)?._id?.toString() || (trip.driverId as any)?.toString();

    const notification = {
      eventType: 'bookingCreated',
      tripId,
      trip,
      passengerId,
      driverId,
      bookingData,
      createdAt: new Date(),
    };

    // Emit to passenger's personal room
    IoSocket.to(`user-${passengerId}`).emit('bookingNotification', notification);
    console.log(`✅ [SOCKET] Booking created notification sent to passenger ${passengerId}`);

    // Emit to driver's personal room
    if (driverId) {
      IoSocket.to(`user-${driverId}`).emit('bookingNotification', notification);
      console.log(`✅ [SOCKET] Booking created notification sent to driver ${driverId}`);
    }

    // Emit to trip room
    IoSocket.to(`trip-${tripId}`).emit('bookingNotification', notification);
    console.log(`✅ [SOCKET] Booking created notification sent to trip room ${tripId}`);

    // Get passenger user details for logging
    const passenger = await User.findById(passengerId).select('firstName lastName email').lean();
    console.log(`📋 [SOCKET] Booking created by: ${passenger?.firstName} ${passenger?.lastName} (${passengerId})`);
  } catch (error) {
    console.error('❌ [SOCKET] Error emitting booking created event:', error);
  }
};

/**
 * Emit booking updated notification
 */
export const emitBookingUpdated = async (
  tripId: string,
  passengerId: string,
  driverId: string,
  updateData?: any
) => {
  try {
    console.log('🔄 [SOCKET] Emitting booking updated event:', { tripId, passengerId, driverId });

    if (!IoSocket) {
      console.log('❌ [SOCKET] Socket.IO not available for booking updated event');
      return;
    }

    // Get populated trip
    const trip = await Trip.findById(tripId)
      .populate('driverId', 'firstName lastName email image socketId')
      .populate('passengers.userId', 'firstName lastName email image socketId')
      .lean();

    if (!trip) {
      console.log('❌ [SOCKET] Trip not found:', tripId);
      return;
    }

    const notification = {
      eventType: 'bookingUpdated',
      tripId,
      trip,
      passengerId,
      driverId,
      updateData,
      updatedAt: new Date(),
    };

    // Emit to passenger's personal room
    IoSocket.to(`user-${passengerId}`).emit('bookingNotification', notification);
    console.log(`✅ [SOCKET] Booking updated notification sent to passenger ${passengerId}`);

    // Emit to driver's personal room
    IoSocket.to(`user-${driverId}`).emit('bookingNotification', notification);
    console.log(`✅ [SOCKET] Booking updated notification sent to driver ${driverId}`);

    // Emit to trip room
    IoSocket.to(`trip-${tripId}`).emit('bookingNotification', notification);
    console.log(`✅ [SOCKET] Booking updated notification sent to trip room ${tripId}`);
  } catch (error) {
    console.error('❌ [SOCKET] Error emitting booking updated event:', error);
  }
};

