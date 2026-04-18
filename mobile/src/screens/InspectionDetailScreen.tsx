import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EntryField } from '../components/EntryField';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  getInspectionById,
  submitInspection,
  updateInspectionEntries,
} from '../services/api';
import type { InspectionDetail, InspectionEntry } from '../types/inspection';

type Props = NativeStackScreenProps<RootStackParamList, 'InspectionDetail'>;

export const InspectionDetailScreen = ({ route, navigation }: Props) => {
  const { inspectionId } = route.params;
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [entries, setEntries] = useState<InspectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadInspection = useCallback(async () => {
    setLoading(true);

    try {
      const data = await getInspectionById(inspectionId);
      setInspection(data);
      setEntries(data.entries);
      navigation.setOptions({ title: `Inspection ${data.id}` });
    } finally {
      setLoading(false);
    }
  }, [inspectionId, navigation]);

  useEffect(() => {
    void loadInspection();
  }, [loadInspection]);

  const sections = useMemo(() => {
    const grouped = new Map<string, InspectionEntry[]>();

    entries.forEach((entry) => {
      const section = entry.templateItem.section || 'General';
      const currentEntries = grouped.get(section) ?? [];
      currentEntries.push(entry);
      grouped.set(section, currentEntries);
    });

    return Array.from(grouped.entries());
  }, [entries]);

  const handleChangeValue = (entryId: string, value: string) => {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === entryId
          ? {
            ...entry,
            value,
          }
          : entry,
      ),
    );
  };

  const handleChangeRemarks = (entryId: string, remarks: string) => {
    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === entryId
          ? {
            ...entry,
            remarks,
          }
          : entry,
      ),
    );
  };

  const persistEntries = useCallback(
    async (showMessages: boolean) => {
      if (!inspection) {
        return null;
      }

      if (showMessages) {
        setSaving(true);
        setSaveSuccess(null);
        setSaveError(null);
      }

      try {
        const updatedInspection = await updateInspectionEntries(
          inspection.id,
          entries.map((entry) => ({
            entryId: entry.id,
            value: entry.value ?? '',
            remarks: entry.remarks ?? undefined,
          })),
        );

        setInspection(updatedInspection);
        setEntries(updatedInspection.entries);

        if (showMessages) {
          setSaveSuccess('Entries saved');
        }

        return updatedInspection;
      } catch {
        if (showMessages) {
          setSaveError('Unable to save entries');
        }

        return null;
      } finally {
        if (showMessages) {
          setSaving(false);
        }
      }
    },
    [entries, inspection],
  );

  const handleSave = async () => {
    await persistEntries(true);
  };

  const handleSubmit = async () => {
    if (!inspection) {
      return;
    }

    setSubmitting(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const savedInspection = await persistEntries(false);

      if (!savedInspection) {
        setSaveError('Unable to save entries before submission');
        return;
      }

      const updatedInspection = await submitInspection(savedInspection.id);
      setInspection(updatedInspection);
      setEntries(updatedInspection.entries);
      Alert.alert('Success', 'Inspection submitted');
    } catch {
      Alert.alert('Error', 'Unable to submit inspection');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!inspection) {
    return (
      <View style={styles.center}>
        <Text>Inspection not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>{inspection.template.name}</Text>
      <Text>Status: {inspection.status}</Text>
      <Text>Inspection ID: {inspection.id}</Text>

      {saveSuccess ? <Text style={styles.successText}>{saveSuccess}</Text> : null}
      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Entries</Text>
        {sections.map(([section, sectionEntries]) => (
          <View key={section} style={styles.sectionGroup}>
            <Text style={styles.sectionGroupTitle}>{section}</Text>
            {sectionEntries.map((entry) => (
              <EntryField
                key={entry.id}
                inspectionId={inspection.id}
                templateItemId={entry.templateItem.id}
                entryId={entry.id}
                value={entry.value ?? ''}
                remarks={entry.remarks}
                inputType={entry.templateItem.inputType}
                label={entry.templateItem.label}
                minValue={entry.templateItem.minValue}
                maxValue={entry.templateItem.maxValue}
                isMandatory={entry.templateItem.isMandatory}
                isFlagged={entry.isFlagged}
                onChangeValue={handleChangeValue}
                onChangeRemarks={handleChangeRemarks}
              />
            ))}
          </View>
        ))}
      </View>

      {saving ? (
        <ActivityIndicator />
      ) : (
        <Button title="Save" onPress={handleSave} />
      )}

      <View style={styles.submitSection}>
      {submitting ? (
        <ActivityIndicator />
      ) : (
        <Button title="Submit" onPress={handleSubmit} />
      )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  section: {
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionGroup: {
    marginBottom: 12,
  },
  sectionGroupTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  submitSection: {
    marginTop: 12,
  },
  successText: {
    color: '#15803d',
    marginTop: 8,
  },
  errorText: {
    color: '#b91c1c',
    marginTop: 8,
  },
});
