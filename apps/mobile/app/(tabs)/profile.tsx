import { Button } from '@momaa/ui';
import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import type { Parent } from '@momaa/types';

type PhoneResponse = { data: { parent: Parent; verificationExpiresAt?: string } };
type VerifyResponse = { data: { parent: Parent } };
type ParentResponse = { data: Parent };

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const parent = useAuthStore((state) => state.parent);
  const tokens = useAuthStore((state) => state.tokens);
  const setParent = useAuthStore((state) => state.setParent);
  const signOut = useAuthStore((state) => state.signOut);
  const [phoneNumber, setPhoneNumber] = useState(
    parent?.phoneNumber ? `+${parent.phoneNumber}` : ''
  );
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tokens?.accessToken) return;
    void apiRequest<ParentResponse>('/parents/me', {}, tokens.accessToken)
      .then((result) => {
        setParent(result.data);
        setPhoneNumber(result.data.phoneNumber ? `+${result.data.phoneNumber}` : '');
      })
      .catch((error) => console.error('Unable to load profile:', error));
  }, [setParent, tokens?.accessToken]);

  const sendCode = async () => {
    if (!tokens?.accessToken) return;
    setLoading(true);
    try {
      const result = await apiRequest<PhoneResponse>(
        '/parents/me/phone',
        { method: 'POST', body: JSON.stringify({ phoneNumber }) },
        tokens.accessToken
      );
      setParent(result.data.parent);
      setPhoneNumber(`+${result.data.parent.phoneNumber ?? ''}`);
      setCode('');
      Alert.alert('Verification code sent', 'Check WhatsApp for your six-digit verification code.');
    } catch (error) {
      Alert.alert(
        'Could not send code',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!tokens?.accessToken) return;
    setLoading(true);
    try {
      const result = await apiRequest<VerifyResponse>(
        '/parents/me/phone/verify',
        { method: 'POST', body: JSON.stringify({ code }) },
        tokens.accessToken
      );
      setParent(result.data.parent);
      setCode('');
      Alert.alert('WhatsApp linked', 'You can now log feeds, sleep, and more from WhatsApp.');
    } catch (error) {
      Alert.alert(
        'Could not verify code',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const verified = parent?.isPhoneVerified === true;
  const pending = Boolean(parent?.phoneNumber) && !verified;

  return (
    <Screen>
      <View className="pt-8">
        <Text className="font-jakarta-bold text-3xl text-text-primary">Profile</Text>
        <Text className="mt-2 font-jakarta text-text-secondary">
          {user?.displayName ?? 'Momaa parent'}
        </Text>

        <View className="mt-8 rounded-input border border-border bg-card p-5">
          <Text className="font-jakarta-bold text-lg text-text-primary">Link WhatsApp</Text>
          <Text className="mt-2 font-jakarta text-sm leading-5 text-text-secondary">
            Link your WhatsApp number so Momaa can log feeds, sleep, and more from your messages.
          </Text>
          <Text className="mt-4 font-jakarta-bold text-sm text-text-primary">
            {verified
              ? 'Status: linked and verified'
              : pending
                ? 'Status: pending verification'
                : 'Status: not linked'}
          </Text>
          <TextInput
            className="mt-4 rounded-input border border-border bg-background px-4 py-3 font-jakarta text-text-primary"
            placeholder="WhatsApp number, e.g. +919876543210"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          <Button
            disabled={loading || !phoneNumber.trim()}
            loading={loading}
            onPress={() => void sendCode()}
            style={{ marginTop: 12 }}
          >
            {verified ? 'Change number and send code' : 'Send verification code'}
          </Button>
          {pending ? (
            <>
              <TextInput
                className="mt-4 rounded-input border border-border bg-background px-4 py-3 font-jakarta text-text-primary"
                placeholder="6-digit verification code"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
              <Button
                disabled={loading || code.length !== 6}
                loading={loading}
                onPress={() => void verifyCode()}
                style={{ marginTop: 12 }}
              >
                Verify
              </Button>
            </>
          ) : null}
        </View>

        <Button variant="secondary" onPress={() => void signOut()} style={{ marginTop: 28 }}>
          Sign out
        </Button>
      </View>
    </Screen>
  );
}
