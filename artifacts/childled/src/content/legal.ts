export const CHILD_PROFILE_AUTHORIZATION_STATEMENT =
  'I confirm that I am the parent/legal guardian of this child or have authorization to collect and store this information for educational or therapeutic purposes.';

export const LEGAL_REVIEW_NOTICE =
  'Template notice: Replace the placeholders below with your organization’s reviewed policy before using ChildLed in production. This page is not legal advice and does not itself certify HIPAA, FERPA, or other regulatory compliance.';

export const privacyPolicySections = [
  {
    title: 'Data collection',
    body: 'Placeholder: Describe which child profile details, communication observations, account information, and technical data are collected, why they are collected, and the lawful basis or authorization used.',
  },
  {
    title: 'Audio storage',
    body: 'Placeholder: Explain where private recordings are stored, how long they are retained, how access is limited, and how backup or deletion practices apply.',
  },
  {
    title: 'User rights',
    body: 'Placeholder: Explain how a parent, guardian, authorized school representative, or care-team member can request access, correction, export, restriction, or withdrawal of consent where applicable.',
  },
  {
    title: 'Data deletion requests',
    body: 'Authorized parents, guardians, and care-team members can submit a child-scoped deletion request from the child profile. Select the records to review, and an authorized staff member will document the decision. Consent confirmations and deletion-request audit records are retained as immutable accountability records.',
    link: {
      href: '/children',
      label: 'Open the child profile privacy request form',
    },
  },
  {
    id: 'student-data-confidentiality',
    title: 'Student data and confidentiality',
    body: 'Student information may only be accessed and used for authorized educational or therapeutic purposes. Users must follow their school or organization’s confidentiality, access, retention, and disclosure requirements.',
  },
  {
    title: 'Information sharing',
    body: 'Placeholder: State when information may be shared with invited care-team members, service providers, schools, clinicians, or authorities, and how authorization is verified.',
  },
  {
    title: 'Parent consent',
    body: 'ChildLed requires an explicit legal-authority confirmation before a child profile is created. Placeholder: Describe consent withdrawal, recordkeeping, and age- or jurisdiction-specific requirements.',
  },
  {
    title: 'Security measures',
    body: 'Placeholder: Describe authentication, authorization, encryption, audit logging, access review, incident response, and any approved third-party security controls.',
  },
];

export const termsOfUseSections = [
  {
    title: 'Educational and clinical support tool',
    body: 'ChildLed is intended to help teams organize observations and communication context. Placeholder: State the organization’s intended use and any population, age, or geographic limits.',
  },
  {
    title: 'Professional judgment',
    body: 'ChildLed does not replace the judgment of a licensed professional, individualized assessment, diagnosis, treatment plan, or emergency services. Users remain responsible for appropriate professional consultation.',
  },
  {
    id: 'account-security',
    title: 'Account security',
    body: 'Users must provide accurate information, protect their access credentials, never share an account, invite only authorized care-team members, and prevent unauthorized individuals from accessing student information.',
  },
  {
    title: 'Data ownership',
    body: 'Placeholder: Explain who controls uploaded child information, observations, and recordings; how authorized users can access or export them; and what happens when an account closes.',
  },
  {
    id: 'recording-authorization',
    title: 'Consent requirements',
    body: 'Users are responsible for ensuring that all required school, parent or guardian, and other applicable authorizations are in place before recording or uploading a student’s voice or other protected information.',
  },
  {
    id: 'ai-assisted-output',
    title: 'AI-assisted output',
    body: 'ChildLed may use AI-assisted tools for transcripts, notes, summaries, classifications, or suggestions. These outputs may contain errors and must be reviewed for accuracy before professional use.',
  },
];
