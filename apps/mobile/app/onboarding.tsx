import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from '@momaa/ui';
import { Screen } from '../components/Screen';
import { createBaby, uploadBabyPhoto } from '../lib/baby-api';
import { t, type Language } from '../lib/i18n';
import { useAuthStore } from '../lib/auth-store';

export default function OnboardingScreen() {
  const token = useAuthStore((state) => state.tokens?.accessToken);
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<Language>('en');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<'female' | 'male' | 'unspecified'>('unspecified');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const [saving, setSaving] = useState(false);
  const slides = [
    'A calm place for feeds, sleep, and everyday moments.',
    'Momaa turns your logs into gentle, useful patterns.',
    'Link WhatsApp later in Profile to log updates from messages.'
  ];
  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert('Photo permission needed', 'Allow photo access to add a baby picture.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.75
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  };
  const finish = async () => {
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dob))
      return Alert.alert('Check the details', 'Add a name and date of birth in YYYY-MM-DD format.');
    setSaving(true);
    try {
      const baby = await createBaby(
        {
          firstName: name.trim(),
          dateOfBirth: new Date(`${dob}T00:00:00.000Z`).toISOString(),
          sex
        },
        token
      );
      if (photo) await uploadBabyPhoto(baby.id, photo, token);
      router.replace('/(tabs)' as never);
    } catch (error) {
      Alert.alert(
        'Could not create baby profile',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen>
      <View className="flex-1 justify-center py-10">
        <Text className="font-jakarta-bold text-3xl text-text-primary">
          {t(language, 'welcome')}
        </Text>
        {step < 3 ? (
          <>
            <Text className="mt-5 font-jakarta text-lg leading-8 text-text-secondary">
              {slides[step]}
            </Text>
            {step === 0 ? (
              <View className="mt-8">
                <Text className="font-jakarta-bold text-text-primary">
                  {t(language, 'language')}
                </Text>
                <View className="mt-3 flex-row gap-3">
                  <Button
                    variant={language === 'en' ? 'primary' : 'secondary'}
                    onPress={() => setLanguage('en')}
                  >
                    English
                  </Button>
                  <Button
                    variant={language === 'ml' ? 'primary' : 'secondary'}
                    onPress={() => setLanguage('ml')}
                  >
                    Malayalam
                  </Button>
                </View>
              </View>
            ) : null}
            <Button onPress={() => setStep(step + 1)} style={{ marginTop: 32 }}>
              {step === 2 ? t(language, 'getStarted') : t(language, 'next')}
            </Button>
          </>
        ) : (
          <>
            <Text className="mt-4 font-jakarta text-text-secondary">
              Let’s create your baby’s profile.
            </Text>
            <TouchableOpacity
              onPress={() => void choosePhoto()}
              className="mt-6 h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-section"
            >
              {photo ? (
                <Image source={{ uri: photo.uri }} className="h-full w-full" />
              ) : (
                <Text className="font-jakarta text-text-secondary">Add photo</Text>
              )}
            </TouchableOpacity>
            <TextInput
              className="mt-5 rounded-input border border-border bg-card px-4 py-3 font-jakarta text-text-primary"
              placeholder={t(language, 'babyName')}
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              className="mt-3 rounded-input border border-border bg-card px-4 py-3 font-jakarta text-text-primary"
              placeholder={t(language, 'dob')}
              placeholderTextColor="#9CA3AF"
              value={dob}
              onChangeText={setDob}
            />
            <View className="mt-3 flex-row gap-2">
              <Button
                variant={sex === 'female' ? 'primary' : 'secondary'}
                onPress={() => setSex('female')}
              >
                Girl
              </Button>
              <Button
                variant={sex === 'male' ? 'primary' : 'secondary'}
                onPress={() => setSex('male')}
              >
                Boy
              </Button>
              <Button
                variant={sex === 'unspecified' ? 'primary' : 'secondary'}
                onPress={() => setSex('unspecified')}
              >
                Prefer not to say
              </Button>
            </View>
            <Button
              disabled={saving}
              loading={saving}
              onPress={() => void finish()}
              style={{ marginTop: 24 }}
            >
              {t(language, 'create')}
            </Button>
          </>
        )}
      </View>
    </Screen>
  );
}
