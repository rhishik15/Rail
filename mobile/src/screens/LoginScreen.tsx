import React, { useState } from 'react';
import axios from 'axios';
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';

export const LoginScreen = () => {
  const { login } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(employeeId, password);
    } catch (loginError) {
      const message =
        axios.isAxiosError(loginError) &&
        typeof loginError.response?.data?.message === 'string'
          ? loginError.response.data.message
          : 'Unable to log in. Please try again.';

      setError(message);
      Alert.alert('Login failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Employee ID</Text>
      <TextInput
        style={styles.input}
        value={employeeId}
        onChangeText={setEmployeeId}
        autoCapitalize="none"
        editable={!loading}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      {loading ? <ActivityIndicator /> : <Button title="Login" onPress={handleLogin} disabled={loading} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: '#b91c1c',
  },
});
