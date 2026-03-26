import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { api } from '../api/client';

interface Props {
  channelId: string;
  channelName: string;
  onBack: () => void;
}

export function ChatScreen({ channelId, channelName, onBack }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    api.getMessages(channelId).then((msgs) => {
      setMessages((msgs || []).reverse());
    });
  }, [channelId]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(channelId, input.trim());
      setMessages((prev) => [...prev, msg]);
      setInput('');
      flatListRef.current?.scrollToEnd();
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  }, [channelId, input, sending]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerHash}>#</Text>
        <Text style={styles.headerTitle}>{channelName}</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={styles.message}>
            <View style={styles.msgAvatar}>
              <Text style={styles.msgAvatarText}>
                {(item.author?.username || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.msgBody}>
              <View style={styles.msgHeader}>
                <Text style={styles.msgAuthor}>{item.author?.display_name || item.author?.username}</Text>
                <Text style={styles.msgTime}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={styles.msgContent}>{item.content}</Text>
            </View>
          </View>
        )}
      />

      {/* Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={input}
          onChangeText={setInput}
          placeholder={`Message #${channelName}`}
          placeholderTextColor="#6d6f78"
          multiline
          maxLength={4000}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#313338',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingTop: 56,
    backgroundColor: '#2b2d31',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1f22',
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  backText: {
    color: '#b5bac1',
    fontSize: 20,
    fontWeight: '600',
  },
  headerHash: {
    color: '#6d6f78',
    fontSize: 20,
  },
  headerTitle: {
    color: '#f2f3f5',
    fontSize: 16,
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
  },
  message: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  msgAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5865f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  msgAvatarText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  msgBody: {
    flex: 1,
  },
  msgHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  msgAuthor: {
    color: '#f2f3f5',
    fontWeight: '600',
    fontSize: 15,
  },
  msgTime: {
    color: '#6d6f78',
    fontSize: 11,
  },
  msgContent: {
    color: '#b5bac1',
    fontSize: 15,
    lineHeight: 20,
  },
  composer: {
    flexDirection: 'row',
    padding: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    gap: 8,
    backgroundColor: '#2b2d31',
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#1e1f22',
    borderRadius: 8,
    padding: 10,
    color: '#f2f3f5',
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#5865f2',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
