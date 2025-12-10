export const distanceCalculate = (lat1: number, lat2: number, lon1: number, lon2: number, type: string = 'Km') => {
  // The math module contains a function
  // named toRadians which converts from
  // degrees to radians.
  lon1 = (lon1 * Math.PI) / 180;
  lon2 = (lon2 * Math.PI) / 180;
  lat1 = (lat1 * Math.PI) / 180;
  lat2 = (lat2 * Math.PI) / 180;
  // Haversine formula
  let dlon = lon2 - lon1;
  let dlat = lat2 - lat1;
  let a = Math.pow(Math.sin(dlat / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dlon / 2), 2);
  let c = 2 * Math.asin(Math.sqrt(a));
  // Radius of earth in kilometers. Use 6371
  // for miles . Use 3956
  let r = type == 'Km' ? 6371 : 3956;
  // calculate the result
  return c * r;
};

export const generateRandomNumber = () => {
  const min = Math.pow(10, 11); // Minimum 12-digit number
  const max = Math.pow(10, 12) - 1; // Maximum 12-digit number

  // Generate a random number within the specified range
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

  return randomNumber.toString(); // Convert to string to preserve leading zeros
};

export const generateChatId = () => {
  const min = Math.pow(10, 14); // Minimum 15-digit number
  const max = Math.pow(10, 15) - 1; // Maximum 15-digit number

  // Generate a random number within the specified range
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

  return randomNumber.toString(); // Convert to string to preserve leading zeros
};

export const formatRange = (average: any) => {
  const lowerBound = Math.floor(average / 5) * 5;
  const upperBound = lowerBound + 5;
  return `${lowerBound}-${upperBound}`;
};

export const calculateAvgPrepTime = (data: any) => {
  try {
    const transformedData = data.flatMap((item: any) => {
      const matches = item?.prepTime?.match(/\d+/g); // Use regex to find all numbers in the string

      if (matches) {
        return matches?.map((match: any) => parseInt(match, 10));
      }
      // If no matches are found, return an empty array to omit the item
      return [];
    });

    const sum = transformedData.reduce((acc: number, num: number) => acc + num, 0);
    const average = sum / transformedData.length;

    // console.log(transformedData);
    // console.log('average : ', average);
    // console.log('range : ', formatRange(average));

    return formatRange(average);
  } catch (e) {
    console.log(e, 'error');
    return undefined;
  }
};

export const calculateAvgServiceDuration = (data: any) => {
  try {
    const transformedData = data.flatMap((item: any) => {
      const matches = item?.serviceDuration?.match(/\d+/g); // Use regex to find all numbers in the string
      if (matches) {
        return matches?.map((match: any) => parseInt(match, 10));
      }
      // If no matches are found, return an empty array to omit the item
      return [];
    });

    const sum = transformedData.reduce((acc: number, num: number) => acc + num, 0);
    const average = sum / transformedData.length;

    return formatRange(average);
  } catch (e) {
    console.log(e, 'error');
    return undefined;
  }
};
export const calculateAvgServiceDurationForServiceItems = (data: any) => {
  try {
    const transformedData = data.flatMap((item: any) => {
      const matches = item?.serviceDuration?.match(/\d+/g); // Use regex to find all numbers in the string
      if (matches) {
        return matches?.map((match: any) => parseInt(match, 10));
      }
      // If no matches are found, return an empty array to omit the item
      return [];
    });

    const sum = transformedData.reduce((acc: number, num: number) => acc + num, 0);
    const average = sum / transformedData.length;

    return Math.round(average / 10) * 10
  } catch (e) {
    console.log(e, 'error');
    return undefined;
  }
};
export default distanceCalculate;
