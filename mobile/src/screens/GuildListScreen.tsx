import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { api } from '../api/client';

interface Props {
  onSelectGuild: (guild: any) => void;
}

export function GuildListScreen({ onSelectGuild }: Props) {
  const [guilds, setGuilds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyGuilds()
      .then(setGuilds)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Servers</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Loading...</Text>
        </View>
      ) : guilds.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No servers yet</Text>
        </View>
      ) : (
        <FlatList
          data={guilds}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.guildItem}
              onPress={() => onSelectGuild(item)}
            >
              <View style={styles.guildIcon}>
                <Text style={styles.guildInitials}>
                  {item.name
                    .split(/\s+/)
                    .map((w: string) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.guildName}>{item.name}</Text>
                {item.member_count && (
                  <Text style={styles.muted}>{item.member_count} members</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2b2d31',
  },
  header: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#1e1f22',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f2f3f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guildItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1f22',
  },
  guildIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#5865f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guildInitials: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  guildName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f3f5',
  },
  muted: {
    fontSize: 13,
    color: '#6d6f78',
  },
});
