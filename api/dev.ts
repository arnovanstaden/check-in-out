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