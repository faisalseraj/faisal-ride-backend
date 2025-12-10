// src/lib/pulse.ts
import { Pulse } from "@pulsecron/pulse";
import config from "../config/config";

let pulse: Pulse;

export function getPulse(): Pulse {
  if (!pulse) {
    pulse = new Pulse({
      db: {
        address: config.mongoose.url,
        collection: "pulseJobs",
      }, // reuse existing mongoose connection
    });

    pulse.on("error", (err:any) => {
      console.error("Pulse error:", err);
    });

    // pulse.start(); // start processing jobs
  }

  return pulse;
}
