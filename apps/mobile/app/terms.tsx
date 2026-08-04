import { LegalDocument } from '../components/LegalDocument';

export default function TermsScreen() {
  return (
    <LegalDocument
      title="Terms of Service"
      updated="August 4, 2026"
      intro="These Terms of Service govern your use of Momaa AI. By using the service, you agree to these Terms."
      sections={[
        {
          title: 'Using Momaa AI',
          body:
            'You may use Momaa AI only in compliance with these Terms and applicable law. You are responsible for the accuracy of information you provide and for keeping your account credentials confidential.'
        },
        {
          title: 'Not medical advice',
          body:
            'Momaa AI provides general information and organizational tools. It does not provide medical advice, diagnosis, or treatment, and it is not a substitute for a qualified healthcare professional. Seek professional care for medical questions or emergencies.'
        },
        {
          title: 'Acceptable use',
          body:
            'Do not misuse the service, attempt unauthorized access, interfere with its operation, submit unlawful content, or use Momaa AI in a way that harms others or violates their rights.'
        },
        {
          title: 'Service changes',
          body:
            'We may modify, suspend, or discontinue features when reasonably necessary. We may update these Terms from time to time; continued use after an update means you accept the updated Terms.'
        },
        {
          title: 'Contact',
          body: 'For questions about these Terms, contact Momaa AI at sreenandhavr161@gmail.com.'
        }
      ]}
    />
  );
}
