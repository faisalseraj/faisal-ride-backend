import { apartmentComplexController, apartmentComplexValidation } from '../../modules/apartmentComplex';
import express, { Router } from 'express';

import { auth } from '../../modules/auth';
import { validate } from '../../modules/validate';

const router: Router = express.Router();
router
  .route('/')
  .get(
    auth('manageApartmentComplex'),
    validate(apartmentComplexValidation.queryApartmentComplexes),
    apartmentComplexController.queryApartmentComplexes
  )
  .post(
    auth('manageApartmentComplex'),
    validate(apartmentComplexValidation.createApartmentComplex),
    apartmentComplexController.createApartmentComplex
  );

router
  .route('/:apartmentComplexId/apartment')
  .post(
    auth('manageApartments'),
    validate(apartmentComplexValidation.createUpdateApartment),
    apartmentComplexController.createUpdateApartment
  );
// use by renter for managing licenses
router
  .route('/:apartmentComplexId/apartment/:apartmentId')
  .patch(
    auth('manageSelfLicense'),
    validate(apartmentComplexValidation.createOrUpdateRenterLicenses),
    apartmentComplexController.createOrUpdateRenterLicenses
  );

router.route('/apartment/:apartmentId/renters').get(
  auth('manageApartments'),
  // validate(apartmentComplexValidation.createOrUpdateRenterLicenses),
  apartmentComplexController.getApartmentRentersByApartmentId
);

router.route('/apartment/:apartmentId/renter/:renterId').delete(
  auth('manageApartments'),
  // validate(apartmentComplexValidation.createOrUpdateRenterLicenses),
  apartmentComplexController.removeApartmentRenter
);

router
  .route('/attachRenterToApartment')
  .post(
    auth('manageApartments'),
    validate(apartmentComplexValidation.attachRenterToApartment),
    apartmentComplexController.attachRenterToApartment
  );

router
  .route('/attachExistingLicense')
  .post(
    auth('manageSelfLicense'),
    validate(apartmentComplexValidation.attachExistingLicense),
    apartmentComplexController.attachExistingLicense
  );

router.route('/listApartmentComplexes').get(auth('self'), apartmentComplexController.listApartmentComplexes);

router
  .route('/listApartments/:apartmentComplexId')
  .get(auth('self'), validate(apartmentComplexValidation.listApartments), apartmentComplexController.listApartments);
router
  .route('/addLicensesToApartmentComplex')

  .post(
    auth('manageLicenses'),
    validate(apartmentComplexValidation.addLicensesToApartmentComplex),
    apartmentComplexController.addLicensesToApartmentComplex
  );

router
  .route('/removeLicenseFromApartmentComplex')

  .post(
    auth('manageLicenses'),
    validate(apartmentComplexValidation.removeLicenseFromApartmentComplex),
    apartmentComplexController.removeLicenseFromApartmentComplexController
  );

router
  .route('/:id/status')
  .get(
    auth('manageApartmentComplex'),
    validate(apartmentComplexValidation.getApartmentComplexStatus),
    apartmentComplexController.getApartmentComplexStatus
  );

router
  .route('/:id')
  .get(
    auth('self'),
    validate(apartmentComplexValidation.getApartmentComplexById),
    apartmentComplexController.getApartmentComplexById
  )
  .patch(
    auth('manageApartmentComplex'),
    validate(apartmentComplexValidation.updateApartmentComplex),
    apartmentComplexController.modifyApartmentComplexById
  )
  .delete(
    auth('manageApartmentComplex'),
    validate(apartmentComplexValidation.deleteApartmentComplexById),
    apartmentComplexController.removeApartmentComplexById
  );

/**
 * curl -X GET \
  http://localhost:3000/v1/apartmentComplex \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json'
 */

/**
 * curl -X GET \
  http://localhost:3000/v1/apartmentComplex/:id \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json'
 */

/**
 * curl -X PATCH \
  http://localhost:3000/v1/apartmentComplex/:id \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","totalParkingSpaces":100}'
 */

/**
 * curl -X DELETE \
  http://localhost:3000/v1/apartmentComplex/:id \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json'
 */
export default router;
