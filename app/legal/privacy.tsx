import { LegalPage } from '@/components/LegalPage';
import { SUPPORT_EMAIL } from '@/constants/support';

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="July 14, 2026"
      sections={[
        {
          body: 'This policy describes what Staked collects, why, and who processes it. Short version: we collect the minimum needed to run money-backed challenges, we never sell your data, and you can delete everything in-app.',
        },
        {
          heading: 'What we collect',
          body: 'Your email address and password (for your account); your challenges and check-ins (name, stake, goal cadence, timestamps); payment status metadata from Stripe (never your card number — card details go directly to Stripe and never touch our servers); an anonymous push-notification token if you enable reminders; and basic product analytics (screens used, feature events).',
        },
        {
          heading: 'Who processes it',
          body: 'Supabase hosts our database and authentication. Stripe processes payments and refunds. PostHog provides product analytics. Expo delivers push notifications. Each processes data only to provide their service to us.',
        },
        {
          heading: 'What we use it for',
          body: 'Running your challenges (computing protected and forfeited amounts), issuing refunds, sending the reminders you opt into, support, and understanding which features work so we can improve the product.',
        },
        {
          heading: 'What we never do',
          body: 'We do not sell your personal data, show third-party ads, or share your goals with anyone. Aggregate, de-identified statistics (e.g. average completion rates) may be used publicly.',
        },
        {
          heading: 'Retention and deletion',
          body: 'Your data is kept while your account exists. Deleting your account in Settings permanently removes your profile, challenges, and check-ins. Stripe retains payment records as required for financial audit and law; we retain nothing that identifies you afterward.',
        },
        {
          heading: 'Security',
          body: 'Data is encrypted in transit, access is scoped per-user at the database level (row-level security), and all money operations run server-side. No system is perfectly secure — if we learn of a breach affecting you, we will notify you.',
        },
        {
          heading: 'Your rights',
          body: 'You can access your data in the app, correct your email by contacting us, and delete your account at any time. Depending on where you live you may have additional rights (e.g. GDPR/CCPA access and portability requests) — email us and we will honor them.',
        },
        {
          heading: 'Contact',
          body: `Privacy questions or requests: ${SUPPORT_EMAIL}.`,
        },
      ]}
    />
  );
}
