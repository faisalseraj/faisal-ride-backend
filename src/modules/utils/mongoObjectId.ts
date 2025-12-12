export const isValidObjectId = (id: string): boolean => {
    // MongoDB ObjectID pattern
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  
    return objectIdPattern.test(id);
  }