import { Button } from '@momaa/ui';
import type { WhatsAppLink } from '@momaa/types';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

type LinksResponse = { data: WhatsAppLink[] };
type LinkResponse = { data: WhatsAppLink };

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const tokens = useAuthStore((state) => state.tokens);
  const signOut = useAuthStore((state) => state.signOut);
  const [links, setLinks] = useState<WhatsAppLink[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const loadLinks = useCallback(async () => {
    if (!tokens?.accessToken) return;
    try {
      const result = await apiRequest<LinksResponse>('/whatsapp-links', {}, tokens.accessToken);
      setLinks(result.data);
    } catch (error) {
      console.error('Unable to load WhatsApp links:', error);
    }
  }, [tokens?.accessToken]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const requestLink = async () => {
    if (!tokens?.accessToken) return;
    setLoading(true);
    try {
      await apiRequest<LinkResponse>(
        editingLinkId ? `/whatsapp-links/${editingLinkId}` : '/whatsapp-links',
        { method: editingLinkId ? 'PATCH' : 'POST', body: JSON.stringify({ phoneNumber }) },
        tokens.accessToken
      );
      setPhoneNumber('');
      setEditingLinkId(undefined);
      await loadLinks();
      Alert.alert('Verification sent', 'Check WhatsApp for the six-digit verification code.');
    } catch (error) {
      Alert.alert('Could not link WhatsApp', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyLink = async (link: WhatsAppLink) => {
    if (!tokens?.accessToken) return;
    setLoading(true);
    try {
      await apiRequest<LinkResponse>(
        `/whatsapp-links/${link.id}/verify`,
        { method: 'POST', body: JSON.stringify({ code: code.trim() }) },
        tokens.accessToken
      );
      setCode('');
      await loadLinks();
      Alert.alert('WhatsApp linked', 'Messages sent from this number can now be recorded in Momaa.');
    } catch (error) {
      Alert.alert('Could not verify number', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const unlink = async (link: WhatsAppLink) => {
    if (!tokens?.accessToken) return;
    setLoading(true);
    try {
      await apiRequest<void>(`/whatsapp-links/${link.id}`, { method: 'DELETE' }, tokens.accessToken);
      await loadLinks();
    } catch (error) {
      Alert.alert('Could not unlink WhatsApp', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View className="pt-8">
        <Text className="font-jakarta-bold text-3xl text-text-primary">Profile</Text>
        <Text className="mt-2 font-jakarta text-text-secondary">
          {user?.displayName ?? 'Momaa parent'}
        </Text>

        <View className="mt-8 rounded-input border border-border bg-card p-5">
          <Text className="font-jakarta-bold text-lg text-text-primary">WhatsApp</Text>
          <Text className="mt-2 font-jakarta text-sm leading-5 text-text-secondary">
            Link and verify your number to log updates such as “fed 90ml” from WhatsApp.
          </Text>
          <TextInput
            className="mt-4 rounded-input border border-border bg-background px-4 py-3 font-jakarta text-text-primary"
            autoCapitalize="none"
            keyboardType="phone-pad"
            placeholder="+91 98765 43210"
            placeholderTextColor="#9CA3AF"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          <Button disabled={loading || !phoneNumber.trim()} loading={loading} onPress={() => void requestLink()} style={{ marginTop: 12 }}>
            {editingLinkId ? 'Update and resend code' : 'Send verification code'}
          </Button>

          {links.map((link) => (
            <View key={link.id} className="mt-5 border-t border-border pt-4">
              <Text className="font-jakarta-bold text-text-primary">{link.phoneNumber}</Text>
              <Text className="mt-1 font-jakarta text-sm text-text-secondary">
                {link.status === 'verified' ? 'Verified and ready for WhatsApp updates.' : 'Verification required.'}
              </Text>
              {link.status === 'pending' ? (
                <>
                  <TextInput
                    className="mt-3 rounded-input border border-border bg-background px-4 py-3 font-jakarta text-text-primary"
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="Six-digit code"
                    placeholderTextColor="#9CA3AF"
                    value={code}
                    onChangeText={setCode}
                  />
                  <Button disabled={loading || code.trim().length !== 6} loading={loading} onPress={() => void verifyLink(link)} style={{ marginTop: 12 }}>
                    Verify number
                  </Button>
                </>
              ) : null}
              <Button variant="ghost" disabled={loading} onPress={() => void unlink(link)} style={{ marginTop: 6 }}>
                Unlink number
              </Button>
              <Button
                variant="ghost"
                disabled={loading}
                onPress={() => {
                  setEditingLinkId(link.id);
                  setPhoneNumber(link.phoneNumber);
                }}
                style={{ marginTop: 2 }}
              >
                Update number
              </Button>
            </View>
          ))}
        </View>

        <Button variant="secondary" onPress={() => void signOut()} style={{ marginTop: 28 }}>
          Sign out
        </Button>
      </View>
    </Screen>
  );
}
