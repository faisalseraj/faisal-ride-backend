import { Constants } from '../modules/utils/Constants';
import config from '../config/config';

// Override console.log, console.warn, console.error, console.info when not in LOCAL mode
if (config.serverType !== Constants.localServer) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.trace = () => {};
}

export {};
