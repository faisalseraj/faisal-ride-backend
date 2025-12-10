import Joi from 'joi';

export const licenseProcessingBody: any = {
  mainOCRTool: Joi.string().required().valid('google', 'azure'),
  reasoningTool: Joi.string().required().valid('chatgpt', 'gemini', 'xai'),
  secondaryOCRTool: Joi.string().required().valid('chatgpt', 'gemini', 'xai'),
};

export const createlicenseProcessing = {
  body: Joi.object().keys(licenseProcessingBody),
};

export const updatelicenseProcessing = {
  body: Joi.object().keys({
    ...licenseProcessingBody,
    _id: Joi.string(),
  }),
};

// export const getlicenseProcessing = {
//   params: Joi.object().keys({
//     // id: Joi.string(),
//   }),
// };
