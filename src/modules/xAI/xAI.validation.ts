import Joi from 'joi';

export const queryChatGPT = {
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

export const businessRecommendations = {
  query: Joi.object().keys({
    prompt: Joi.string().required(),
  }),
};

export const categoryRecommendationForSite = {
  query: Joi.object().keys({
    siteId: Joi.string().required(),
  }),
};

export const businessCategoryLanguageTranslation = {
  body: Joi.object().keys({
    category: Joi.object().keys({
      name: Joi.string().required(),
      description: Joi.string().required(),
    }),
  }),
};

export const generateSEOContentForBusiness = {
  params: Joi.object().keys({
    siteId: Joi.string().required(),
  }),
};

export const conversationAnalysis = {
  body: Joi.object().keys({
    ticketId: Joi.string().required(),
    language: Joi.string(),
  }),
};
