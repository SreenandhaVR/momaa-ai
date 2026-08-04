import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

type Section = {
  title: string;
  body: string | ReactNode;
};

type LegalDocumentProps = {
  title: string;
  updated: string;
  intro: string;
  sections: Section[];
};

export function LegalDocument({ title, updated, intro, sections }: LegalDocumentProps) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="mx-auto w-full max-w-3xl px-6 py-12">
      <Text className="font-jakarta-bold text-4xl text-text-primary">{title}</Text>
      <Text className="mt-3 font-jakarta text-sm text-text-secondary">Last updated: {updated}</Text>
      <Text className="mt-8 font-jakarta text-base leading-7 text-text-primary">{intro}</Text>
      {sections.map((section) => (
        <View key={section.title} className="mt-8">
          <Text className="font-jakarta-bold text-xl text-text-primary">{section.title}</Text>
          {typeof section.body === 'string' ? (
            <Text className="mt-3 font-jakarta text-base leading-7 text-text-primary">{section.body}</Text>
          ) : (
            section.body
          )}
        </View>
      ))}
    </ScrollView>
  );
}
