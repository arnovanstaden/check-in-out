import { App, ExpressReceiver, InteractiveMessage } from '@slack/bolt';
import dotenv from 'dotenv';
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

let checkedInUsers: { id: string, name: string }[] = [];
let checkedOutUsers: { id: string, name: string }[] = [];

app.command('/checkin', async ({ command, ack, respond }) => {
  await ack();
  const { user_id, user_name, channel_id } = command;

  // Add the user to the checked-in list if not already there
  if (!checkedInUsers.some(user => user.id === user_id)) {
    checkedInUsers.push({
      id: user_id,
      name: user_name.charAt(0).toUpperCase() + user_name.slice(1)
    });
  }

  const userList = checkedInUsers.map(user => `✅ *${user.name}* checked in`).join('\n');

  try {
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel_id,
      text: userList,
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

app.action({ callback_id: 'check_in_callback' }, async ({ body, ack }) => {
  try {
    await ack();
  } catch (error) {
    console.error('Error acknowledging action:', error);
  }

  const interactiveBody = body as InteractiveMessage;
  const { message_ts } = interactiveBody;
  const userId = interactiveBody.user.id;
  const userName = interactiveBody.user.name.charAt(0).toUpperCase() + interactiveBody.user.name.slice(1);

  // Add the user to the checked-in list if not already there
  if (!checkedInUsers.some(user => user.id === userId)) {
    checkedInUsers.push({ id: userId, name: userName });
  }

  // Remove the user from the checked-out list if they are there
  checkedOutUsers = checkedOutUsers.filter(user => user.id !== userId);

  const userList = checkedInUsers.map(user => `✅ *${user.name}* checked in`).join('\n');

  // Update the original message with the list of checked-in users
  try {
    await app.client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel!.id!,
      ts: message_ts!,
      text: userList,
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

  // Add the user to the checked-out list if not already there
  if (!checkedOutUsers.some(user => user.id === user_id)) {
    checkedOutUsers.push({
      id: user_id,
      name: user_name.charAt(0).toUpperCase() + user_name.slice(1)
    });
  }

  const userList = checkedOutUsers.map(user => `❌ *${user.name}* checked out`).join('\n');

  // Join the channel before sending a message
  try {
    await app.client.conversations.join({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel_id,
    });

    // Send a message with a "Check Out" button
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel_id,
      text: userList,
      attachments: [
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
app.action({ callback_id: 'check_out_callback' }, async ({ body, ack, }) => {

  try {
    await ack();
  } catch (error) {
    console.error('Error acknowledging action:', error);
  }

  const interactiveBody = body as InteractiveMessage;
  const { message_ts } = interactiveBody;
  const userId = interactiveBody.user.id;
  const userName = interactiveBody.user.name.charAt(0).toUpperCase() + interactiveBody.user.name.slice(1);

  // Add the user to the checked-in list if not already there
  if (!checkedOutUsers.some(user => user.id === userId)) {
    checkedOutUsers.push({ id: userId, name: userName });
  }

  const userList = checkedOutUsers.map(user => `❌ *${user.name}* checked out`).join('\n');

  // Update the original message with the list of checked-out users
  try {
    await app.client.chat.update({
      token: process.env.SLACK_BOT_TOKEN,
      channel: body.channel!.id!,
      ts: message_ts!,
      text: userList,
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

// Start your app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Bolt app is running!');
})();