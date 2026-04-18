import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { getInspections } from '../services/api';
import type { InspectionListItem } from '../types/inspection';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'InspectionList'>;

export const InspectionListScreen = ({ navigation }: Props) => {
  const { logout } = useAuth();
  const [inspections, setInspections] = useState<InspectionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInspections = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getInspections();
      setInspections(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInspections();
  }, [loadInspections]);

  useFocusEffect(
    useCallback(() => {
      void loadInspections();
    }, [loadInspections]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={inspections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerButton}>
            <Button
              title="Logout"
              onPress={() => {
                logout();
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }}
            />
          </View>
          <Button
            title="+ New Inspection"
            onPress={() => navigation.navigate('CreateInspection')}
          />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.item}
          onPress={() =>
            navigation.navigate('InspectionDetail', { inspectionId: item.id })
          }
        >
          <Text style={styles.title}>{item.id}</Text>
          <Text>{item.status}</Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text>No inspections found</Text>}
    />
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 12,
  },
  headerButton: {
    marginBottom: 12,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  item: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
});
