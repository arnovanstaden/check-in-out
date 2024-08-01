import { Databases, ID, Query, Client } from 'node-appwrite';
import dotenv from 'dotenv';
import { SlackUser } from './user';
import moment from 'moment-timezone';
import { getTimeToDisplay } from './dev';
dotenv.config();


export interface DBUser {
  id: string;
  name: string;
  /**
   * In UTC
   */
  timestamp: string;
  tz_offset: number;
  /*
The time the check in or check out was made as string with optional timezone
  */
  time: string;
}


const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('slack-check-in-out')
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const dbID = 'daily_checks';
const checkInCollectionID = '66a223d00038c475eb4c';
const checkOutCollectionID = '66a223d8000e32b6fb1e';

const now = moment().utc();
const startOfDay = now.clone().startOf('day').toISOString();
const endOfDay = now.clone().endOf('day').toISOString();

/**
 * Check if a user is already checked in or out
 */
export const verifyUserIsCheckedInOut = async (userId: string, type: 'in' | 'out'): Promise<boolean> => {
  const query = [
    Query.equal('id', userId),
    Query.greaterThanEqual('timestamp', startOfDay),
    Query.lessThan('timestamp', endOfDay),
  ];

  try {
    const result = await databases.listDocuments(
      dbID,
      type === 'in' ? checkInCollectionID : checkOutCollectionID,
      query,
    );
    return result.total > 0;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export const getUserWhoStartedProcess = async (type: 'in' | 'out'): Promise<DBUser | null> => {
  console.log(`Getting user who started check-${type} process`);
  console.log(`Start of day: ${startOfDay}`);
  console.log(`End of day: ${endOfDay}`);

  const query = [
    Query.greaterThanEqual('timestamp', startOfDay),
    Query.lessThan('timestamp', endOfDay),
    Query.orderAsc('timestamp'),
  ];

  try {
    const result = await databases.listDocuments(
      dbID,
      type === 'in' ? checkInCollectionID : checkOutCollectionID,
      query,
    );

    const userWhoStarted = result.documents[0]
    console.log(`User who started check-${type} process`, userWhoStarted);

    if (!userWhoStarted) {
      return null;
    }

    return {
      ...userWhoStarted,
      time: getTimeToDisplay(userWhoStarted.timestamp, userWhoStarted.tz_offset),
    } as unknown as DBUser;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export const checkUserInOrOut = async (user: SlackUser, type: 'in' | 'out'): Promise<DBUser> => {
  const currentUTCTimestamp = moment().utc().toISOString();

  try {
    const res = await databases.createDocument(
      dbID,
      type === 'in' ? checkInCollectionID : checkOutCollectionID,
      ID.unique(),
      {
        id: user.id,
        name: user.name,
        timestamp: currentUTCTimestamp,
        tz_offset: user.tz_offset,
      },
    );

    return {
      ...res,
      time: getTimeToDisplay(res.timestamp, res.tz_offset),
    } as unknown as DBUser;
  } catch (error) {
    console.error(error);
    return {} as DBUser;
  }
}
