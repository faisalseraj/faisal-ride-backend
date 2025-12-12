export function delayFunction(ms: any) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }