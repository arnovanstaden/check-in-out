import { App, ExpressReceiver, InteractiveMessage, Block } from '@slack/bolt';
import dotenv from 'dotenv';
import { checkUserInOrOut, checkUserIsCheckedInOut } from './appwrite';
import { getTimeFromTimestamp } from './dev';
import { getUserInfo } from './user';
import { WebClient } from '@slack/web-api';

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
});

app.command('/checkin', async ({ command, ack, respond, client }) => {
  await ack();
  const { user_id, user_name, channel_id } = command;

  const userIsCheckedIn = await checkUserIsCheckedInOut(user_id, 'in');
  if (userIsCheckedIn) {
    await respond({
      text: `You are already checked in today :(.`,
      response_type: 'ephemeral'
    });
    return
  }

  const userInfo = await getUserInfo(client as unknown as WebClient, user_id, user_name);
  const newlyCheckedInUser = await checkUserInOrOut(userInfo, 'in');

  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel_id,
      blocks: [{
        type: "context",
        elements: [
          {
            type: "image",
            image_url: userInfo.image,
            alt_text: "user avatar"
          },
          {
            type: "mrkdwn",
            text: `*${userInfo.name}* checked in at ${newlyCheckedInUser.time}`,
          }
        ]
      }],
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

app.action({ callback_id: 'check_in_callback' }, async ({ body, ack, client }) => {
  try {
    await ack();
  } catch (error) {
    console.error('Error acknowledging action:', error);
  }

  const interactiveBody = body as InteractiveMessage;
  const userId = interactiveBody.user.id;
  const userName = interactiveBody.user.name;

  const userIsCheckedIn = await checkUserIsCheckedInOut(userId, 'in');
  if (userIsCheckedIn) {
    await app.client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      channel: interactiveBody.channel.id,
      user: userId,
      text: `You are already checked in today :(.`,
    });
    return
  }

  const { message_ts, original_message } = interactiveBody;
  const userInfo = await getUserInfo(client as unknown as WebClient, userId, userName);
  const newlyCheckedInUser = await checkUserInOrOut(userInfo, 'in');

  const oldBlocks = original_message!.blocks ? original_message!.blocks as unknown as Block[] : [];

  // Update the original message with the list of checked-in users
  try {
    await app.client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel!.id!,
      ts: message_ts!,
      blocks: [
        ...oldBlocks,
        {
          type: "context",
          elements: [
            {
              type: "image",
              image_url: userInfo.image,
              alt_text: "user avatar"
            },
            {
              type: "mrkdwn",
              text: `*${userInfo.name}* checked in at ${newlyCheckedInUser.time}`,
            }
          ]
        }
      ],
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
app.command('/checkout', async ({ command, ack, respond, client }) => {
  await ack();
  const { user_id, user_name, channel_id } = command;

  const userIsCheckedOut = await checkUserIsCheckedInOut(user_id, 'out');
  if (userIsCheckedOut) {
    await respond({
      text: `You are already checked out today :(.`,
      response_type: 'ephemeral'
    });
    return
  }

  const userInfo = await getUserInfo(client as unknown as WebClient, user_id, user_name);
  const newlyCheckedInUser = await checkUserInOrOut(userInfo, 'in');

  // Join the channel before sending a message
  try {
    // Send a message with a "Check Out" button
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel_id,
      blocks: [{
        type: "context",
        elements: [
          {
            type: "image",
            image_url: userInfo.image,
            alt_text: "user avatar"
          },
          {
            type: "mrkdwn",
            text: `*${userInfo.name}* checked out at ${newlyCheckedInUser.time}`,
          }
        ]
      }], attachments: [
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
app.action({ callback_id: 'check_out_callback' }, async ({ body, ack, client }) => {
  try {
    await ack();
  } catch (error) {
    console.error('Error acknowledging action:', error);
  }

  const interactiveBody = body as InteractiveMessage;
  const userId = interactiveBody.user.id;
  const userName = interactiveBody.user.name;

  const userIsCheckedOut = await checkUserIsCheckedInOut(userId, 'out');
  if (userIsCheckedOut) {
    await app.client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      channel: interactiveBody.channel.id,
      user: userId,
      text: `You are already checked out today :(.`,
    });
    return
  }


  const { message_ts, original_message } = interactiveBody;
  const userInfo = await getUserInfo(client as unknown as WebClient, userId, userName);
  const newlyCheckedInUser = await checkUserInOrOut(userInfo, 'in');

  const oldBlocks = original_message!.blocks ? original_message!.blocks as unknown as Block[] : [];


  // Update the original message with the list of checked-out users
  try {
    await app.client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel!.id!,
      ts: message_ts!,
      blocks: [
        ...oldBlocks,
        {
          type: "context",
          elements: [
            {
              type: "image",
              image_url: userInfo.image,
              alt_text: "user avatar"
            },
            {
              type: "mrkdwn",
              text: `*${userInfo.name}* checked out at ${newlyCheckedInUser.time}`,
            }
          ]
        }
      ],
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
receiver.router.get('/slack/auth', async (req, res) => {
  const { code } = req.query;

  try {
    await app.client.oauth.v2.access({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code: code as string,
      redirect_uri: 'https://yourapp.com/auth/slack',
    });

    // Save access token and team info to your database
    res.send('Your app has been installed!');
  } catch (error) {
    console.error('Error during OAuth:', error);
    res.status(500).send('Error during installation');
  }
});

receiver.router.get('/', async (req, res) => {
  res.send('Home!');
});

receiver.router.head('/uptime', async (req, res) => {
  res.send('OK');
});

(async () => {
  // Start your app
  await app.start({
    port: Number(process.env.PORT) || 3000,
  });
  console.log('⚡️ Bolt app is running!');
})();
