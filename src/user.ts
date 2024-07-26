import { WebClient } from '@slack/web-api';
import moment from 'moment-timezone';

export interface SlackUser {
  image: string;
  tz_offset: number;
  name: string;
  id: string
}

export const getUserInfo = async (client: WebClient, user_id: string, fallback_name: string): Promise<SlackUser> => {
  const userProfile = await client.users.profile.get({ user: user_id });
  const userInfo = await client.users.info({ user: user_id });

  const now = moment.tz('Europe/Berlin');
  const berlinTZOffsetFallback = now.utcOffset() * 60;

  return {
    id: user_id,
    name: userProfile.profile?.display_name || fallback_name,
    image: userProfile.profile?.image_24 || 'https://tandem.net/static/android-chrome-96x96.png',
    tz_offset: userInfo.user?.tz_offset || berlinTZOffsetFallback,
  }
}