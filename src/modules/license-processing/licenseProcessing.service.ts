import { ILicenseProcessing, ILicenseProcessingDoc, LicenseProcessingExtremes } from './licenseProcessing.interfaces';

import LicenseProcessing from './licenseProcessing.model';

/**
 * CRUD operations for License Processing
 */

export const getAllLicenseProcessing = async (): Promise<ILicenseProcessing[]> => {
  return await LicenseProcessing.find();
};

export const getReasoningTokensSummary = async () => {
  const all = await LicenseProcessing.find();
  const summary: Record<string, number> = {};

  all.forEach(({ reasongTool, reasoningTokens }) => {
    summary[reasongTool] = (summary[reasongTool] || 0) + reasoningTokens;
  });

  return Object.entries(summary).map(([tool, totalTokens]) => ({
    tool,
    totalTokens,
  }));
};

export const getOpenAIOCRSummary = async () => {
  const all = await LicenseProcessing.find();
  const summary: Record<string, { totalImagesProcessed: number; totalTokensConsumed: number }> = {};

  all.forEach(({ secondaryOCRRecord }) => {
    const key = secondaryOCRRecord.secondaryOCR;
    if (!summary[key]) {
      summary[key] = { totalImagesProcessed: 0, totalTokensConsumed: 0 };
    }
    (summary[key] as any).totalImagesProcessed += secondaryOCRRecord.totalImagesProcessed;
    (summary[key] as any).totalTokensConsumed += secondaryOCRRecord.aiOCRTokensConsumed;
  });

  return Object.entries(summary).map(([ocrType, stats]) => ({
    ocrType,
    ...stats,
  }));
};

export const getCaseSummary = async () => {
  const all = await LicenseProcessing.find();
  return {
    positiveCases: all.reduce((acc, cur) => acc + cur.positiveCases, 0),
    negativeCases: all.reduce((acc, cur) => acc + cur.negativeCases, 0),
  };
};

export const getImageProcessingSummary = async () => {
  const all = await LicenseProcessing.find();
  return {
    totalPics: all.reduce((acc, cur) => acc + cur.numberOfPics, 0),
    totalLicensesProcessed: all.reduce((acc, cur) => acc + cur.numberOfLicensesProcessed, 0),
  };
};

export const getCompleteDashboardSummary = async () => {
  const [reasoningTokens, openAIOCRSummary, caseSummary, imageProcessingSummary] = await Promise.all([
    getReasoningTokensSummary(),
    getOpenAIOCRSummary(),
    getCaseSummary(),
    getImageProcessingSummary(),
  ]);

  return {
    reasoningTokens,
    openAIOCRSummary,
    caseSummary,
    imageProcessingSummary,
  };
};

export const createLicenseProcessing = async (licenseProcessingBody: ILicenseProcessing): Promise<ILicenseProcessingDoc> => {
  return LicenseProcessing.create(licenseProcessingBody);
};

export const getLicenseProcessing = async (id: string): Promise<ILicenseProcessingDoc | null> => {
  return LicenseProcessing.findById(id);
};

export const updateLicenseProcessing = async (
  _id: string,
  updateBody: Partial<ILicenseProcessing>
): Promise<ILicenseProcessingDoc | null> => {
  return LicenseProcessing.findByIdAndUpdate(_id, updateBody, { new: true, runValidators: true });
};

export const deleteLicenseProcessing = async (id: string): Promise<ILicenseProcessingDoc | null> => {
  return LicenseProcessing.findByIdAndDelete(id);
};

export const getLicenseProcessingStatistics = async (): Promise<{ mainOcr: string; count: number }[]> => {
  const stats = await LicenseProcessing.aggregate([
    {
      $group: {
        _id: '$mainOcr',
        count: { $sum: 1 },
      },
    },
  ]);
  return stats;
};

export const getLicenseProcessingExtremes = async (): Promise<LicenseProcessingExtremes> => {
  const data = await LicenseProcessing.find().populate('user');

  const reasoningTokenMap = {
    chatgpt: 0,
    gemini: 0,
    xai: 0,
  };

  const secondaryOcrMap = {
    chatgpt: 0,
    gemini: 0,
    xai: 0,
  };

  let maxPositive = { user: '', value: -Infinity };
  let minPositive = { user: '', value: Infinity };
  let maxNegative = { user: '', value: -Infinity };
  let minNegative = { user: '', value: Infinity };

  for (const record of data) {
    reasoningTokenMap[record.reasongTool] += record?.reasoningTokens;
    const ocrType = record.secondaryOCRRecord?.secondaryOCR;
    if (ocrType) {
      secondaryOcrMap[ocrType] += record.secondaryOCRRecord?.totalImagesProcessed || 0;
    }

    // Positive cases
    if (record.positiveCases > maxPositive.value) {
      maxPositive = { user: record.user?.email || record.user?.toString(), value: record.positiveCases };
    }
    if (record.positiveCases < minPositive.value) {
      minPositive = { user: record.user?.email || record.user?.toString(), value: record.positiveCases };
    }

    // Negative cases
    if (record.negativeCases > maxNegative.value) {
      maxNegative = { user: record.user?.email || record.user?.toString(), value: record.negativeCases };
    }
    if (record.negativeCases < minNegative.value) {
      minNegative = { user: record.user?.email || record.user?.toString(), value: record.negativeCases };
    }
  }

  const maxReasoningTool = Object.entries(reasoningTokenMap).reduce(
    (max, [tool, val]) => (val > max.value ? { tool: tool as 'chatgpt' | 'gemini' | 'xai', value: val } : max),
    { tool: 'chatgpt', value: -Infinity }
  );

  const minReasoningTool = Object.entries(reasoningTokenMap).reduce(
    (min, [tool, val]) => (val < min.value ? { tool: tool as 'chatgpt' | 'gemini' | 'xai', value: val } : min),
    { tool: 'chatgpt', value: Infinity }
  );

  const maxOCRTool = Object.entries(secondaryOcrMap).reduce(
    (max, [ocrType, val]) => (val > max.value ? { ocrType: ocrType as 'chatgpt' | 'gemini' | 'xai', value: val } : max),
    { ocrType: 'chatgpt', value: -Infinity }
  );

  const minOCRTool = Object.entries(secondaryOcrMap).reduce(
    (min, [ocrType, val]) => (val < min.value ? { ocrType: ocrType as 'chatgpt' | 'gemini' | 'xai', value: val } : min),
    { ocrType: 'chatgpt', value: Infinity }
  );

  return {
    highest: {
      reasoningTool: maxReasoningTool,
      ocr: maxOCRTool,
      positiveCases: maxPositive,
      negativeCases: maxNegative,
    },
    lowest: {
      reasoningTool: minReasoningTool,
      ocr: minOCRTool,
      positiveCases: minPositive,
      negativeCases: minNegative,
    },
  };
};
