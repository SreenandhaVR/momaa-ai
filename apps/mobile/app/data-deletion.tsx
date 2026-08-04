import { LegalDocument } from '../components/LegalDocument';

export default function DataDeletionScreen() {
  return (
    <LegalDocument
      title="Data Deletion Instructions"
      updated="August 4, 2026"
      intro="You can request deletion of your Momaa AI account and associated personal data at any time."
      sections={[
        {
          title: 'How to submit a request',
          body:
            'Email sreenandhavr161@gmail.com with the subject line “Delete My Momaa AI Data”. Please send the request from the email address associated with your Momaa AI account, or include enough account information for us to verify your request.'
        },
        {
          title: 'What happens next',
          body:
            'We will confirm receipt, verify the request when necessary, and process deletion within 7 business days. We will notify you when the request is complete.'
        },
        {
          title: 'Limited retention',
          body:
            'We may retain limited information where required by law or reasonably necessary for security, fraud prevention, dispute resolution, or enforcement of our agreements. Any retained information will be handled in accordance with our Privacy Policy.'
        }
      ]}
    />
  );
}
