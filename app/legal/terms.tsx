import { LegalPage } from '@/components/LegalPage';
import { SUPPORT_EMAIL } from '@/constants/support';

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="July 14, 2026"
      sections={[
        {
          body: 'Staked is a commitment app: you put real money behind a personal goal. These terms explain exactly what happens to that money. Please read them — by creating an account or a challenge you agree to them.',
        },
        {
          heading: '1. How a challenge works',
          body: 'You define a goal, a duration, and a stake between $50 and $2,500, and pay the stake plus a $3 platform fee up front. Each day of the challenge protects a proportional share of your stake (stake ÷ duration). When you meet your goal for a check-in window, that window’s share stays protected; when you miss a window, its share is forfeited. Forfeits are capped at your stake — you can never owe more.',
        },
        {
          heading: '2. Check-in windows are UTC',
          body: 'Windows close at midnight UTC (daily), Monday 00:00 UTC (weekly), or the 1st at 00:00 UTC (monthly). The app always shows the deadline in your local time. Check-ins are manual and on your honor — but they cannot be backdated.',
        },
        {
          heading: '3. Getting your money back',
          body: 'When your challenge ends, claim it in the app: the protected amount is refunded to your original payment method, typically within 5–10 business days. The $3 platform fee is not refundable. Refunds become impossible roughly 180 days after your original payment (a card-network limit), so claim promptly; we send reminders and may settle long-unclaimed challenges automatically.',
        },
        {
          heading: '4. Quitting early',
          body: 'You can quit an active challenge at any time. You receive your protected amount minus a 20% early-exit penalty. Quitting is irreversible.',
        },
        {
          heading: '5. Forfeited money and charity',
          body: 'Forfeited amounts (including quit penalties) are retained by Staked and donated in a monthly batch to the charity you selected at creation. Donations are made by Staked in its own name — they are not tax-deductible for you, and listed charities are independent organizations that do not sponsor or endorse Staked.',
        },
        {
          heading: '6. Not a bank, not investment advice',
          body: 'Your stake is a payment held against your own commitment, not a deposit, investment, or wager against other people. It earns no interest. Staked is not a bank, escrow agent, or financial adviser.',
        },
        {
          heading: '7. Fair use',
          body: 'One account per person. We may cancel challenges and refund stakes (minus fees) if we detect fraud, payment abuse, or attempts to manipulate check-ins. Chargebacks on an active or settled challenge forfeit the challenge.',
        },
        {
          heading: '8. Account deletion',
          body: 'You can delete your account in Settings at any time once you have no active challenges. Deletion is permanent and removes your data as described in the Privacy Policy.',
        },
        {
          heading: '9. Liability',
          body: 'The app is provided as-is. To the maximum extent permitted by law, Staked’s total liability for any claim is limited to the amount you paid for the challenge in question. Nothing in these terms limits liability that cannot legally be limited.',
        },
        {
          heading: '10. Changes and contact',
          body: `We may update these terms; material changes will be shown in the app before they take effect. Questions or issues: ${SUPPORT_EMAIL}.`,
        },
      ]}
    />
  );
}
