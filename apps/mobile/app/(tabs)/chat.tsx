import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card } from '@momaa/ui';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { apiRequest } from '../../lib/api';
import { uploadBabyMedia } from '../../lib/baby-api';
import { useAuthStore } from '../../lib/auth-store';
import { useBabies } from '../../lib/babies';

type Message = { sender: 'parent' | 'assistant'; text: string };
export default function ChatScreen() {
  const token = useAuthStore((state) => state.tokens?.accessToken);
  const { data: babies } = useBabies();
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const baby = babies?.[0];
  const send = useMutation({
    mutationFn: (message: string) =>
      apiRequest<{ data: { reply: string } }>(
        `/babies/${baby!.id}/chat`,
        { method: 'POST', body: JSON.stringify({ message }) },
        token
      ),
    onSuccess: (result, message) => {
      setMessages((current) => [
        ...current,
        { sender: 'parent', text: message },
        { sender: 'assistant', text: result.data.reply }
      ]);
      setText('');
    },
    onError: (error) =>
      Alert.alert(
        'Momaa AI is unavailable',
        error instanceof Error ? error.message : 'Please try again shortly.'
      )
  });
  const submit = () => {
    const message = text.trim();
    if (message && baby) send.mutate(message);
  };
  const attachPhoto = async () => {
    if (!baby) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert('Photo permission needed', 'Allow photo access to share a baby photo.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75
    });
    if (result.canceled) return;
    try {
      const asset = result.assets[0];
      const uploaded = await uploadBabyMedia(
        baby.id,
        {
          uri: asset.uri,
          name: asset.fileName ?? 'baby-photo.jpg',
          type: asset.mimeType ?? 'image/jpeg'
        },
        token
      );
      setMessages((current) => [
        ...current,
        { sender: 'parent', text: `Shared a photo: ${uploaded.title}` },
        { sender: 'assistant', text: 'I saved that photo to your baby’s memories.' }
      ]);
    } catch (error) {
      Alert.alert(
        'Could not upload photo',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };
  return (
    <Screen>
      <View className="flex-1 pt-8">
        <Text className="font-jakarta-bold text-3xl text-text-primary">Chat</Text>
        {!baby ? (
          <Card style={{ marginTop: 24 }}>
            <Text className="font-jakarta text-text-secondary">
              Create a baby profile on Dashboard before starting a conversation.
            </Text>
          </Card>
        ) : (
          <>
            <Text className="mt-2 font-jakarta text-text-secondary">
              Talking about {baby.firstName}
            </Text>
            <ScrollView
              className="mt-5 flex-1"
              contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
            >
              {!messages.length ? (
                <Text className="font-jakarta text-text-secondary">
                  Ask about recent feeds, sleep, or today’s routine.
                </Text>
              ) : null}
              {messages.map((message, index) => (
                <Card
                  key={`${message.sender}-${index}`}
                  style={{ backgroundColor: message.sender === 'parent' ? '#FFF4CC' : '#FFFFFF' }}
                >
                  <Text className="font-jakarta-bold text-sm text-text-primary">
                    {message.sender === 'parent' ? 'You' : 'Momaa AI'}
                  </Text>
                  <Text className="mt-1 font-jakarta leading-6 text-text-secondary">
                    {message.text}
                  </Text>
                </Card>
              ))}
            </ScrollView>
            <TextInput
              className="rounded-input border border-border bg-card px-4 py-3 font-jakarta text-text-primary"
              placeholder="Message Momaa AI"
              placeholderTextColor="#9CA3AF"
              value={text}
              onChangeText={setText}
              multiline
            />
            <Button variant="ghost" onPress={() => void attachPhoto()} style={{ marginTop: 6 }}>
              Add baby photo
            </Button>
            <Button
              onPress={submit}
              disabled={!text.trim() || send.isPending}
              style={{ marginTop: 10 }}
            >
              {send.isPending ? 'Thinking…' : 'Send'}
            </Button>
          </>
        )}
      </View>
    </Screen>
  );
}
