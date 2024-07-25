import appWrite, { Databases, ID, Query } from 'node-appwrite';
import dotenv from 'dotenv';
import { User } from '.';
dotenv.config();

let client = new appWrite.Client();

client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('slack-check-in-out')
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const dbID = 'daily_checks';
const checkInCollectionID = '66a223d00038c475eb4c';
const checkOutCollectionID = '66a223d00038c475eb4c';

const now = new Date();
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

/**
 * Check if a user is already checked in
 */
export const checkUserIsCheckedIn = async (userId: string): Promise<boolean> => {
  const query = [
    Query.equal('id', userId),
    Query.greaterThanEqual('timestamp', startOfDay),
    Query.lessThan('timestamp', endOfDay),
  ];

  const result = await databases.listDocuments(
    dbID,
    checkInCollectionID,
    query,
  );

  return result.total > 0;
}

export const checkInUser = async (userId: string, userName: string): Promise<User> => {
  const res = await databases.createDocument(
    dbID,
    checkInCollectionID,
    ID.unique(),
    {
      id: userId,
      name: userName.charAt(0).toUpperCase() + userName.slice(1),
      timestamp: new Date().toISOString(),
    },
  );

  return res as unknown as User;
}