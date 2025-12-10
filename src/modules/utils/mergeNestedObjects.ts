export const mergeNestedObjects = (target: any, ...sources: any) => {
  sources.forEach((source: any) => {
    Object.keys(source).forEach((key) => {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) {
          target[key] = {};
        }
        mergeNestedObjects(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
  });
  return target;
};
