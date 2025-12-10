import * as passkeyController from './passkey.controller';
import * as passkeyInterfaces from './passkey.interfaces';
import * as passkeyService from './passkey.service';
import * as passkeyValidation from './passkey.validation';

import { Passkey } from './passkey.model';

// Export individual functions to avoid naming conflicts
export {
  createPasskey,
  validatePasskey,
  checkPasskeyRequirement,
  getPasskey,
  deletePasskey,
  getPasskeysForPSP,
  getPasskeysForTowCompany,
} from './passkey.controller';

export {
  createPasskey as createPasskeyService,
  validatePasskey as validatePasskeyService,
  checkPasskeyRequirement as checkPasskeyRequirementService,
  getPasskey as getPasskeyService,
  deletePasskey as deletePasskeyService,
  getPasskeysForPSP as getPasskeysForPSPService,
  getPasskeysForTowCompany as getPasskeysForTowCompanyService,
} from './passkey.service';

export { passkeyController, passkeyInterfaces, Passkey, passkeyService, passkeyValidation };
