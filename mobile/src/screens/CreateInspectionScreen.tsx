import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  createInspection,
  getLocomotives,
  getTemplates,
} from '../services/api';
import type { LocomotiveOption, TemplateOption } from '../types/inspection';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateInspection'>;

export const CreateInspectionScreen = ({ navigation }: Props) => {
  const [locomotives, setLocomotives] = useState<LocomotiveOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedLocoId, setSelectedLocoId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      setLoading(true);
      setError(null);

      try {
        const [locomotiveData, templateData] = await Promise.all([
          getLocomotives(),
          getTemplates(),
        ]);

        setLocomotives(locomotiveData);
        setTemplates(templateData);
        setSelectedLocoId(locomotiveData[0]?.id ?? '');
        setSelectedTemplateId(templateData[0]?.id ?? '');
      } catch {
        setError('Failed to load options');
        Alert.alert('Error', 'Unable to load locomotive and template options.');
      } finally {
        setLoading(false);
      }
    };

    void loadOptions();
  }, []);

  const handleCreate = async () => {
    if (creating || loading) {
      return;
    }

    if (!selectedLocoId || !selectedTemplateId) {
      setError('Select a locomotive and template');
      Alert.alert('Missing details', 'Select a locomotive and template.');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const inspection = await createInspection({
        locoId: selectedLocoId,
        templateId: selectedTemplateId,
      });

      navigation.replace('InspectionDetail', { inspectionId: inspection.id });
    } catch {
      setError('Failed to create inspection');
      Alert.alert('Error', 'Unable to create inspection.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Locomotive</Text>
      <View style={styles.pickerContainer}>
        <Picker
          enabled={!creating}
          selectedValue={selectedLocoId}
          onValueChange={(value) => setSelectedLocoId(String(value))}
        >
          <Picker.Item label="Select locomotive" value="" />
          {locomotives.map((locomotive) => (
            <Picker.Item
              key={locomotive.id}
              label={locomotive.locoNumber}
              value={locomotive.id}
            />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Template</Text>
      <View style={styles.pickerContainer}>
        <Picker
          enabled={!creating}
          selectedValue={selectedTemplateId}
          onValueChange={(value) => setSelectedTemplateId(String(value))}
        >
          <Picker.Item label="Select template" value="" />
          {templates.map((template) => (
            <Picker.Item
              key={template.id}
              label={`${template.name} v${template.version}`}
              value={template.id}
            />
          ))}
        </Picker>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {creating ? <ActivityIndicator /> : <Button title="Create Inspection" onPress={handleCreate} disabled={creating || loading} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    marginBottom: 16,
  },
  error: {
    color: '#b91c1c',
    marginBottom: 12,
  },
});
