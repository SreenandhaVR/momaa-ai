import { LegalDocument } from '../components/LegalDocument';

export default function PrivacyScreen() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updated="August 4, 2026"
      intro={'Momaa AI ("we", "us", or "our") provides tools that help parents and caregivers record and organize baby-care information. This Privacy Policy explains how we handle information when you use the Momaa AI app and related services.'}
      sections={[
        {
          title: 'Information we collect',
          body:
            'We collect information you provide to create and use an account, including contact and profile details, baby-care information, messages, photos or other content you choose to submit, and support requests. We may also collect technical information needed to operate, secure, and improve the service.'
        },
        {
          title: 'How we use information',
          body:
            'We use information to provide and maintain Momaa AI, personalize requested features, respond to support requests, protect the service, and comply with applicable legal obligations. Momaa AI is not a substitute for professional medical advice, diagnosis, or treatment.'
        },
        {
          title: 'Sharing',
          body:
            'We do not sell personal information. We may share information with service providers that help us operate Momaa AI, when required by law, or when necessary to protect the rights, safety, and security of Momaa AI, our users, or others.'
        },
        {
          title: 'Retention and security',
          body:
            'We retain information for as long as needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements. We use reasonable safeguards designed to protect information, but no online service can guarantee absolute security.'
        },
        {
          title: 'Children',
          body:
            'Momaa AI is intended for parents and caregivers. Children should not create Momaa AI accounts. Information about a child is provided and managed by the child’s parent or caregiver.'
        },
        {
          title: 'Your choices and contact',
          body:
            'You may request access, correction, or deletion of your personal information as described on our Data Deletion page. For privacy questions, contact Momaa AI at sreenandhavr161@gmail.com.'
        }
      ]}
    />
  );
}
