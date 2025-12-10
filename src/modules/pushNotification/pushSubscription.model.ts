import { IPushSubscriptionDoc, IPushSubscriptionModel } from "./pushSubscription.interfaces";
import { Schema, model } from "mongoose";

const PushSubscriptionSchema = new Schema<IPushSubscriptionDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true }, // 🔑 link subscription to user
    endpoint: { type: String, required: true, unique: true },
    expirationTime: { type: Number, required: false },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ user: 1 });

const PushSubscription = model<IPushSubscriptionDoc, IPushSubscriptionModel>(
  "PushSubscription",
  PushSubscriptionSchema
);
export default PushSubscription