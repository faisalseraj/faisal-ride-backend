type ObjectType = { [key: string]: any };

export enum SortOrder {
    Ascending = 'asc',
    Descending = 'desc',
  }
  
  export const sortArrayOfObjectsByKey = (
    array: ObjectType[],
    key: string,
    sortOrder: SortOrder = SortOrder.Ascending
  ): ObjectType[] => {
    return array.sort((a, b) => {
      const valueA = getNestedValue(a, key);
      const valueB = getNestedValue(b, key);
      let comparison = 0;
  
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
      } else if (typeof valueA === 'string' && typeof valueB === 'string') {
        const lowerCaseValueA = valueA.toLowerCase();
        const lowerCaseValueB = valueB.toLowerCase();
        comparison = lowerCaseValueA.localeCompare(lowerCaseValueB);
      } else if (valueA instanceof Date && valueB instanceof Date) {
        comparison = valueA.getTime() - valueB.getTime();
      } else if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
        comparison = valueA === valueB ? 0 : valueA ? 1 : -1;
      } else {
        const stringA = String(valueA);
        const stringB = String(valueB);
        comparison = stringA.localeCompare(stringB);
      }
  
      return sortOrder === SortOrder.Descending ? comparison * -1 : comparison;
    });
  };
  

function getNestedValue(obj: ObjectType, path: string): any {
  const keys = path.split('.');
  return keys.reduce((value, key) => (value ? value[key] : undefined), obj);
}
