import round from 'lodash/round';
function formatToMillion(number: number) {
  if (number >= 1000000) {
    return round(number / 1000000, 1) + 'm';
  } else if (number >= 1000) {
    return round(number / 1000, 1) + 'k';
  } else {
    return number?.toFixed(2);
  }
}


export const formatRatings = (object: any) => {
    return {
        5: formatToMillion(object['5']),
        4: formatToMillion(object['4']),
        3: formatToMillion(object['3']),
        2: formatToMillion(object['2']),
        1: formatToMillion(object['1']),
    }
}

export default formatToMillion;


