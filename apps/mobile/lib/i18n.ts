export type Language = 'en' | 'ml';
const messages = {
  en: {
    welcome: 'Welcome to Momaa',
    next: 'Next',
    getStarted: 'Get started',
    language: 'Language',
    babyName: "Baby's name",
    dob: 'Date of birth (YYYY-MM-DD)',
    create: 'Create baby profile'
  },
  ml: {
    welcome: 'Momaaയിലേക്ക് സ്വാഗതം',
    next: 'Next',
    getStarted: 'Get started',
    language: 'ഭാഷ',
    babyName: "Baby's name",
    dob: 'ജനന തീയതി (YYYY-MM-DD)',
    create: 'Create baby profile'
  }
};
export const t = (language: Language, key: keyof typeof messages.en) => messages[language][key];
