import { Button } from '@momaa/ui';
import type { WhatsAppLink } from '@momaa/types';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

type LinksResponse = { data: WhatsAppLink[] };
type PairingCodeResponse = { data: { code: string; expiresAt: string } };

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const tokens = useAuthStore((state) => state.tokens);
  const signOut = useAuthStore((state) => state.signOut);
  const [links, setLinks] = useState<WhatsAppLink[]>([]);
  const [pairingCode, setPairingCode] = useState<string>();
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

  const createPairingCode = async () => {
    if (!tokens?.accessToken) return;
    setLoading(true);
    try {
      const result = await apiRequest<PairingCodeResponse>(
        '/whatsapp-links/pairing-code',
        { method: 'POST' },
        tokens.accessToken
      );
      setPairingCode(result.data.code);
      Alert.alert(
        'Pairing code ready',
        `From the WhatsApp number you want to link, send: link ${result.data.code}`
      );
    } catch (error) {
      Alert.alert('Could not create pairing code', error instanceof Error ? error.message : 'Please try again.');
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
            Generate a pairing code, then send it from the WhatsApp number you want to use.
          </Text>
          <Button disabled={loading} loading={loading} onPress={() => void createPairingCode()} style={{ marginTop: 12 }}>
            Generate pairing code
          </Button>
          {pairingCode ? (
            <>
              <Text className="mt-4 font-jakarta-bold text-center text-2xl tracking-widest text-text-primary">
                link {pairingCode}
              </Text>
              <Text className="mt-2 text-center font-jakarta text-sm text-text-secondary">
                Send this from WhatsApp within 10 minutes.
              </Text>
            </>
          ) : null}

          {links.map((link) => (
            <View key={link.id} className="mt-5 border-t border-border pt-4">
              <Text className="font-jakarta-bold text-text-primary">{link.phoneNumber}</Text>
              <Text className="mt-1 font-jakarta text-sm text-text-secondary">
                {link.status === 'verified' ? 'Linked and ready for WhatsApp updates.' : 'Verification required.'}
              </Text>
              <Button variant="ghost" disabled={loading} onPress={() => void unlink(link)} style={{ marginTop: 6 }}>
                Unlink number
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
