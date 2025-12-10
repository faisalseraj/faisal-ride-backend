import moment from 'moment';

export const getWeekStartAndEnd = (weekNumber:number) => {
    const now = moment.utc(); // Get the current time in UTC
    
    // Add the specified number of weeks to the current date
    const targetDate = now.add(weekNumber, 'weeks');
  
    // Get start and end of the week in UTC
    const startOfWeekDate = targetDate.clone().startOf('week').utc();
    const endOfWeekDate = targetDate.clone().endOf('week').utc();
  
    return {
      firstDayOfWeek: startOfWeekDate.toDate(), // Convert to JavaScript Date
      lastDayOfWeek: endOfWeekDate.toDate(),       // Convert to JavaScript Date
    };
  };