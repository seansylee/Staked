import PostHog from 'posthog-react-native';

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const hasRealKey = !!apiKey && !apiKey.includes('placeholder') && !apiKey.startsWith('your_');

type Analytics = Pick<PostHog, 'capture' | 'identify' | 'reset'>;

const noop: Analytics = {
  capture: () => {},
  identify: () => {},
  reset: () => {},
};

// Without a real key PostHog would queue and retry every event forever;
// a no-op keeps analytics from generating network noise in dev.
export const posthog: Analytics = hasRealKey
  ? new PostHog(apiKey, { host: 'https://us.i.posthog.com' })
  : noop;
