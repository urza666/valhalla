import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { api } from '../api/client';

interface Props {
  onLogin: (user: any, token: string) => void;
}

export function LoginScreen({ onLogin }: Props) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      let res;
      if (isLogin) {
        res = await api.login(email, password);
      } else {
        res = await api.register(username, email, password);
      }
      await api.setToken(res.token);
      onLogin(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.form}>
        <Text style={styles.title}>{isLogin ? 'Welcome back!' : 'Create an account'}</Text>
        <Text style={styles.subtitle}>
          {isLogin ? 'Sign in to Valhalla' : 'Join the conversation'}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isLogin && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>USERNAME</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor="#6d6f78"
              autoCapitalize="none"
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email@example.com"
            placeholderTextColor="#6d6f78"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#6d6f78"
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Loading...' : isLogin ? 'Log In' : 'Register'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.switch}>
            {isLogin ? "Need an account? Register" : 'Already have an account? Log In'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1f22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  form: {
    backgroundColor: '#313338',
    borderRadius: 8,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f2f3f5',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#b5bac1',
    textAlign: 'center',
    marginBottom: 20,
  },
  error: {
    color: '#f23f43',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b5bac1',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1e1f22',
    borderRadius: 4,
    padding: 10,
    color: '#f2f3f5',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#5865f2',
    borderRadius: 4,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switch: {
    color: '#00a8fc',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
});
