import { App, ExpressReceiver, InteractiveMessage, LogLevel } from '@slack/bolt';
import dotenv from 'dotenv';
import { checkUserInOrOut, checkUserIsCheckedInOut } from './appwrite';
import { getTimeFromTimestamp } from './dev';
dotenv.config();

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET!;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN!;
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;

// Initialize your custom receiver
const receiver = new ExpressReceiver({
  signingSecret: SLACK_SIGNING_SECRET,
  endpoints: '/slack/events',
});

// Initializes your app with your bot token and signing secret
const app = new App({
  token: SLACK_BOT_TOKEN,
  receiver,
  port: Number(process.env.PORT) || 3000,
});

app.use(async ({ next }) => {
  await next();
});

export interface User {
  id: string;
  name: string;
  timestamp: string;
}

app.command('/checkin', async ({ command, ack, respond }) => {
  await ack();
  const { user_id, user_name, channel_id } = command;

  const userIsCheckedIn = await checkUserIsCheckedInOut(user_id, 'in');
  if (userIsCheckedIn) {
    await respond({
      text: `You are already checked in :(.`,
      response_type: 'ephemeral'
    });
    return
  }

  const newlyCheckedInUser = await checkUserInOrOut(user_id, user_name, 'in');

  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel_id,
      text: `✔️ *${newlyCheckedInUser.name}* checked in at ${getTimeFromTimestamp(newlyCheckedInUser.timestamp)}`,
      attachments: [
        {
          text: 'Who else is here?',
          fallback: 'An error occurred while trying to check in',
          callback_id: 'check_in_callback',
          color: '#3AA3E3',
          actions: [
            {
              name: 'check_in',
              text: 'Check In',
              type: 'button',
              value: 'check_in',
              id: 'check_in',
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
});

app.action({ callback_id: 'check_in_callback' }, async ({ body, ack, respond }) => {
  try {
    await ack();
  } catch (error) {
    console.error('Error acknowledging action:', error);
  }

  const interactiveBody = body as InteractiveMessage;
  const { message_ts, original_message } = interactiveBody;
  const userId = interactiveBody.user.id;
  const userName = interactiveBody.user.name.charAt(0).toUpperCase() + interactiveBody.user.name.slice(1);

  const userIsCheckedIn = await checkUserIsCheckedInOut(userId, 'in');
  if (userIsCheckedIn) {
    await respond({
      text: `You are already checked in :(.`,
      response_type: 'ephemeral'
    });
    return
  }

  const newlyCheckedInUser = await checkUserInOrOut(userId, userName, 'in');
  const userCheckInText = `✔️ *${newlyCheckedInUser.name}* checked in at ${getTimeFromTimestamp(newlyCheckedInUser.timestamp)}`;
  const newMessageText = original_message ? `${original_message.text}\n${userCheckInText}` : userCheckInText;

  // Update the original message with the list of checked-in users
  try {
    await app.client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel!.id!,
      ts: message_ts!,
      text: newMessageText,
      attachments: [
        {
          text: 'Who else is here?',
          fallback: 'You are unable to check in',
          callback_id: 'check_in_callback',
          color: '#3AA3E3',
          actions: [
            {
              name: 'check_in',
              text: 'Check In',
              type: 'button',
              value: 'check_in',
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('Error updating message:', error);
  }
});

// Handle the /checkout command
app.command('/checkout', async ({ command, ack, respond }) => {
  await ack();
  const { user_id, user_name, channel_id } = command;

  const userIsCheckedOut = await checkUserIsCheckedInOut(user_id, 'out');
  if (userIsCheckedOut) {
    await respond({
      text: `You are already checked out :(.`,
      response_type: 'ephemeral'
    });
    return
  }

  const newlyCheckedOutUser = await checkUserInOrOut(user_id, user_name, 'out');

  // Join the channel before sending a message
  try {
    // Send a message with a "Check Out" button
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel_id,
      text: `✔️ *${newlyCheckedOutUser.name}* checked out at ${getTimeFromTimestamp(newlyCheckedOutUser.timestamp)}`, attachments: [
        {
          text: 'Who else is out?',
          fallback: 'An error occurred while trying to check out',
          callback_id: 'check_out_callback',
          color: '#3AA3E3',
          actions: [
            {
              name: 'check_out',
              text: 'Check Out',
              type: 'button',
              value: 'check_out',
            },
          ],
        },
      ],
    });

  } catch (error) {
    console.error('Error sending message:', error);
  }
});

// Handle the check_out button action
app.action({ callback_id: 'check_out_callback' }, async ({ body, ack, respond }) => {

  try {
    await ack();
  } catch (error) {
    console.error('Error acknowledging action:', error);
  }

  const interactiveBody = body as InteractiveMessage;
  const { message_ts, original_message } = interactiveBody;
  const userId = interactiveBody.user.id;
  const userName = interactiveBody.user.name.charAt(0).toUpperCase() + interactiveBody.user.name.slice(1);

  const userIsCheckedOut = await checkUserIsCheckedInOut(userId, 'out');
  if (userIsCheckedOut) {
    await respond({
      text: `You are already checked out :(.`,
      response_type: 'ephemeral'
    });
    return
  }

  const newlyCheckedOutUser = await checkUserInOrOut(userId, userName, 'out');
  const userCheckOutText = `✔️ *${newlyCheckedOutUser.name}* checked out at ${getTimeFromTimestamp(newlyCheckedOutUser.timestamp)}`;
  const newMessageText = original_message ? `${original_message.text}\n${userCheckOutText}` : userCheckOutText;
  // Update the original message with the list of checked-out users
  try {
    await app.client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel!.id!,
      ts: message_ts!,
      text: newMessageText,
      attachments: [
        {
          text: 'Who else is out?',
          fallback: 'You are unable to check out',
          callback_id: 'check_out_callback',
          color: '#3AA3E3',
          actions: [
            {
              name: 'check_out',
              text: 'Check Out',
              type: 'button',
              value: 'check_out',
            },
          ],
        },
      ],
    });

  } catch (error) {
    console.error('Error updating message:', error);
  }
});

// OAuth handler
receiver.router.get('/auth/slack', async (req, res) => {
  const { code } = req.query;

  try {
    const response = await app.client.oauth.v2.access({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code: code as string,
      redirect_uri: 'https://yourapp.com/auth/slack',
    });

    const { access_token, team } = response;
    // Save access token and team info to your database
    res.send('Your app has been installed!');
  } catch (error) {
    console.error('Error during OAuth:', error);
    res.status(500).send('Error during installation');
  }
});

(async () => {
  // Start your app
  await app.start();

  console.log('⚡️ Bolt app is running!');
})();

module.exports = app;