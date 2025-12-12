import Joi from 'joi';

export const systemSettingsBody: any = {
  mainOCRTool: Joi.string().required().valid('google', 'azure'),
  reasoningTool: Joi.string().required().valid('chatgpt', 'gemini', 'xai'),
  secondaryOCRTool: Joi.string().required().valid('chatgpt', 'gemini', 'xai'),
};

export const createSystemSettings = {
  body: Joi.object().keys(systemSettingsBody),
};

export const updateSystemSettings = {
  body: Joi.object().keys({
    ...systemSettingsBody,
    _id: Joi.string(),
  }),
};

// export const getSystemSettings = {
//   params: Joi.object().keys({
//     // id: Joi.string(),
//   }),
// };
