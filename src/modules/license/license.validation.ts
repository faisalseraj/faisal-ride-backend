import Joi from 'joi';

export const queryGemini = {
  query: Joi.object().keys({
    prompt: Joi.string().required(),
    model: Joi.string().required(),
    maxCharacters: Joi.number().required(),
    businessName: Joi.string(),
    itemName: Joi.string(),
    serviceName: Joi.string(),
    previousMessage: Joi.string(),
    additionalData: Joi.string(),
    chatId: Joi.string(),
    language: Joi.string()
      .required()
      .valid(
        'english',
        'spanish',
        'arabic',
        'french',
        'german',
        'russian',
        'portuguese',
        'italian',
        'hebrew',
        'dutch',
        'bulgarian',
        'greek',
        'swedish'
      ),
  }),
};

export const scanLicensesWithOcr = {
  query: Joi.object().keys({
    apartmentComplexId: Joi.string(),
  }),
};
