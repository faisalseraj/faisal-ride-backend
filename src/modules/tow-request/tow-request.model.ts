import { ITowRequestDoc, ITowRequestModel, TowRequestStatuses } from './tow-request.interfaces';

import mongoose from 'mongoose';
import paginate from '../paginate/paginate';
import toJSON from '../toJSON/toJSON';

// ---------- Nested Schemas ----------

// Location schema (pickup, destination, current)
const locationSchema = new mongoose.Schema(
  {
    address: { type: String, required: true },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    lat: { type: String },
    lng: { type: String },
    distance: { type: String },
    county: { type: String },
  },
  { _id: false }
);

// Charge item schema
const chargeItemSchema = new mongoose.Schema(
  {
    quantity: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

// Charges schema
const chargesSchema = new mongoose.Schema(
  {
    unloadedEnrouteMileage: { type: chargeItemSchema },
    loadedHookedMileage: { type: chargeItemSchema },
    impoundFee: { type: chargeItemSchema },
    privatePropertyTowFee: { type: chargeItemSchema },
    notificationFee: { type: chargeItemSchema },
    dailyImpoundRate: { type: chargeItemSchema },
    // Consent-based tow fee (manually adjustable, only used for Consent tow type)
    consentTowFee: { type: Number, default: 0 },
    subTotal: { type: Number },
  },
  { _id: false }
);

// ---------- Main TowRequest Schema ----------

const towRequestSchema = new mongoose.Schema<ITowRequestDoc, ITowRequestModel>(
  {
    // Requester info
    requestCreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true },
    reminders: { type: [String], default: [] },
    sentTo: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' },

    // License plates
    licensePlates: {
      type: [
        {
          plateText: { type: String, required: true },
          croppedImage: { type: String, required: true },
          completeImage: { type: String, required: true },
        },
      ],
      _id: false,
      required: true,
    },

    // Vehicle information
    requesterPhoneNumber: { type: String, required: false },
    vehicleYear: { type: String }, // kept as string (FE sends string)
    vehicleMake: { type: String },
    vehicleModel: { type: String },
    vehicleColor: { type: String },
    vehicleType: { type: String },
    driveType: { type: String },
    vin: { type: String, required: false },
    odometer: { type: String }, // kept as string
    stockNumber: { type: String },
    hasKeys: { type: Boolean, default: false },
    keysLocation: { type: String },

    // Tow details
    towType: { type: String, enum: ['PPI', 'Consent'], required: true },
    invoiceNumber: { type: String, unique: true, sparse: true }, // optional but unique
    jurisdiction: { type: String },
    driverBadgeNumber: { type: String },
    truckNumber: { type: String },
    eta: { type: String }, // ISO string from FE
    impoundDate: { type: String }, // stored as string
    inventoryDate: { type: String },
    vehicleSecuredDate: { type: String },
    accountNotes: { type: String },
    impoundNotes: { type: String },
    gateCode: { type: String },

    // Charges
    charges: { type: chargesSchema },

    // Locations
    location: { type: locationSchema, required: false },
    destination: { type: locationSchema, required: false },
    towOperatorLocation: { type: locationSchema }, // optional
    liveLocation: { type: locationSchema }, // Real-time location when accepted

    // Assignment details
    towCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pspCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedToName: { type: String },
    assignedToEmail: { type: String },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedByName: { type: String },
    assignedByEmail: { type: String },
    towAssignedAt: { type: Date }, // Timestamp when tow was assigned to operator
    referer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    refererEmail: { type: String },
    refererName: { type: String },
    // Status
    status: {
      type: String,
      enum: TowRequestStatuses,
      default: 'PENDING_ASSIGNMENT',
      required: true,
    },
    
    // Vehicle pickup status
    isVehiclePickedUp: {
      type: Boolean,
      default: false,
    },
    
    // Completion timestamp
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// ---------- Plugins ----------
towRequestSchema.plugin(toJSON);
towRequestSchema.plugin(paginate);

// ---------- Model ----------
const TowRequest = mongoose.model<ITowRequestDoc, ITowRequestModel>('TowRequest', towRequestSchema);

export default TowRequest;
