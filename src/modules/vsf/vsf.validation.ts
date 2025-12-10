import Joi from 'joi';

const createVSF = {
  body: Joi.object().keys({
    companyName: Joi.string().allow(''),
    name: Joi.string().required(),
    mcrNumber: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipcode: Joi.string().required(),
    ownerOfficer: Joi.string().required(),
    phone: Joi.string().required(),
    physicalAddress: Joi.string().required(),
    status: Joi.string().optional().allow(''),
    carrierType: Joi.string().valid('vsf', 'tow', '').optional().allow(''),
    scrapedBy: Joi.string().optional().allow(''),
    isActive: Joi.boolean().optional(),
    lat: Joi.number().optional(),
    lng: Joi.number().optional(),
  }),
};

const getVSFs = {
  query: Joi.object().keys({
    city: Joi.string().optional().allow(''),
    state: Joi.string().optional().allow(''),
    zipcode: Joi.string().optional().allow(''),
    carrierType: Joi.string().valid('vsf', 'tow', '').optional().allow(''),
    isActive: Joi.boolean().optional().allow(''),
    search: Joi.string().optional().allow(''),
    companyName: Joi.string().optional().allow(''),
    page: Joi.number().integer().min(1).optional().allow(''),
    limit: Joi.number().integer().optional().allow(''),
    sortBy: Joi.string().valid(
      'companyName',
      'name',
      'city',
      'state',
      'zipcode',
      'createdAt',
      'updatedAt'
    ).optional().allow(''),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
  }),
};

const getVSF = {
  params: Joi.object().keys({
    vsfId: Joi.string().required().hex().length(24),
  }),
};

const updateVSF = {
  params: Joi.object().keys({
    vsfId: Joi.string().required().hex().length(24),
  }),
  body: Joi.object().keys({
    companyName: Joi.string().optional().allow(''),
    name: Joi.string().optional().trim().max(255),
    mcrNumber: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    zipcode: Joi.string().optional().trim().max(10),
    ownerOfficer: Joi.string().optional(),
    phone: Joi.string().optional(),
    physicalAddress: Joi.string().optional(),
    status: Joi.string().optional().trim().max(50),
    carrierType: Joi.string().valid('vsf', 'tow', '').optional().allow(''),
    scrapedBy: Joi.string().optional().allow(''),
    isActive: Joi.boolean().optional(),
  }),
};

const deleteVSF = {
  params: Joi.object().keys({
    vsfId: Joi.string().required().hex().length(24),
  }),
};

const softDeleteVSF = {
  params: Joi.object().keys({
    vsfId: Joi.string().required().hex().length(24),
  }),
};

const bulkCreateVSFs = {
  body: Joi.object().keys({
    companies: Joi.array()
      .items(
        Joi.object().keys({
          companyName: Joi.string().optional().allow(''),
          name: Joi.string().required(),
          mcrNumber: Joi.string().required(),
          city: Joi.string().required(),
          state: Joi.string().required(),
          zipcode: Joi.string().required(),
          ownerOfficer: Joi.string().required(),
          phone: Joi.string().required(),
          physicalAddress: Joi.string().required(),
          status: Joi.string().optional().allow(''),
          carrierType: Joi.string().optional().allow(''),
          scrapedBy: Joi.string().optional().allow(''),
          isActive: Joi.boolean().optional(),
          lat: Joi.number().optional(),
          lng: Joi.number().optional(),
        })
      )
      .min(1)
      .max(100)
      .required(),
  }),
};

const bulkUpdateVSFs = {
  body: Joi.object().keys({
    ids: Joi.array()
      .items(Joi.string().hex().length(24).required())
      .min(1)
      .max(100)
      .required(),
    updates: Joi.object().keys({
      companyName: Joi.string().optional().allow(''),
      name: Joi.string().optional(),
      mcrNumber: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      zipcode: Joi.string().optional(),
      ownerOfficer: Joi.string().optional(),
      phone: Joi.string().optional(),
      physicalAddress: Joi.string().optional(),
      status: Joi.string().optional().allow(''),
      carrierType: Joi.string().valid('vsf', 'tow', '').optional().allow(''),
      scrapedBy: Joi.string().optional().allow(''),
      isActive: Joi.boolean().optional(),
    }).required(),
  }),
};

const bulkDeleteVSFs = {
  body: Joi.object().keys({
    ids: Joi.array()
      .items(Joi.string().hex().length(24).required())
      .min(1)
      .max(100)
      .required(),
  }),
};

const searchVSFsByLocation = {
  query: Joi.object().keys({
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    zipcode: Joi.string().optional(),
    radius: Joi.number().min(1).max(100).optional(),
  }),
};

const getVSFByMcrNumber = {
  query: Joi.object().keys({
    mcrNumber: Joi.string().required(),
  }),
};

const checkVSFExists = {
  query: Joi.object().keys({
    mcrNumber: Joi.string().required(),
  }),
};

const scrapeVSFs = {
  body: Joi.object().keys({
    zipcodes: Joi.array()
      .items(Joi.string().pattern(/^\d{5}(-\d{4})?$/))
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one zipcode is required',
        'array.max': 'Maximum 50 zipcodes allowed',
        'string.pattern.base': 'Invalid zipcode format. Use 12345 or 12345-6789',
      }),
    carrierType: Joi.string().valid('vsf', 'tow', '').optional().default('vsf'),
    delay: Joi.number().min(0.5).max(5.0).optional().default(1.0),
  }),
};

export const vsfValidation = {
  createVSF,
  getVSFs,
  getVSF,
  updateVSF,
  deleteVSF,
  softDeleteVSF,
  bulkCreateVSFs,
  bulkUpdateVSFs,
  bulkDeleteVSFs,
  searchVSFsByLocation,
  getVSFByMcrNumber,
  checkVSFExists,
  scrapeVSFs,
};