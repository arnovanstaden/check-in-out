import moment from 'moment-timezone';

export const getTimeFromTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);

  // Extract hours and minutes
  let hours = date.getUTCHours();
  let minutes: string | number = date.getUTCMinutes();

  // Pad single digit minutes with a leading zero
  minutes = minutes < 10 ? '0' + minutes : minutes;

  // Convert to desired format
  const formattedTime = `${hours}:${minutes}`;

  return formattedTime;
}

export const getTimeToDisplay = (utcTimestamp: string, offsetInSeconds: number): string => {
  // Parse the UTC timestamp
  const utcTime = moment.utc(utcTimestamp);

  // Convert the offset from seconds to minutes
  const offsetMinutes = offsetInSeconds / 60;

  // Convert to the Europe/Berlin timezone
  const berlinTime = utcTime.clone().tz('Europe/Berlin');

  // Get the current offset for Europe/Berlin in minutes
  const berlinOffsetMinutes = berlinTime.utcOffset();

  // Format the Berlin time string
  let timeString = berlinTime.format('HH:mm');

  // Append the timezone offset if it's different from the provided offset
  if (offsetMinutes !== berlinOffsetMinutes) {
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    timeString += ` (${utcTime.clone().utcOffset(offsetMinutes).format('HH:mm')} UTC${sign}${Math.abs(offsetHours)})`;
  }

  return timeString;
}