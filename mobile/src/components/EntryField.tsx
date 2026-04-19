import React, { useState } from 'react';
import {
  Alert,
  Button,
  Image,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';

import api from '../services/api';
import type { TemplateInputType } from '../types/inspection';

interface EntryFieldProps {
  inspectionId: string;
  templateItemId: string;
  entryId: string;
  isUploading: boolean;
  value: string;
  remarks: string | null;
  inputType: TemplateInputType;
  label: string;
  minValue: number | null;
  maxValue: number | null;
  isMandatory: boolean;
  isFlagged: boolean;
  onChangeValue: (entryId: string, value: string) => void;
  onChangeRemarks: (entryId: string, remarks: string) => void;
  onUploadStateChange: (entryId: string, isUploading: boolean) => void;
}

interface UploadMediaResponse {
  fileUrl: string;
}

export const EntryField = ({
  inspectionId,
  templateItemId,
  entryId,
  isUploading,
  value,
  remarks,
  inputType,
  label,
  minValue,
  maxValue,
  isMandatory,
  isFlagged,
  onChangeValue,
  onChangeRemarks,
  onUploadStateChange,
}: EntryFieldProps) => {
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const handleUploadPhoto = async () => {
    if (isUploading) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission required', 'Media permission is required to upload a photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const selectedImageUri = asset.uri;
    const formData = new FormData();

    formData.append('inspectionId', inspectionId);
    formData.append('templateItemId', templateItemId);
    formData.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? `entry-${entryId}-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);

    onUploadStateChange(entryId, true);

    try {
      await api.post<UploadMediaResponse>('/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPreviewUri(selectedImageUri);
    } catch {
      Alert.alert('Upload failed', 'Could not upload the selected image.');
    } finally {
      onUploadStateChange(entryId, false);
    }
  };

  const renderInput = () => {
    if (inputType === 'TEXT') {
      return (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(nextValue) => onChangeValue(entryId, nextValue)}
          placeholder={label}
        />
      );
    }

    if (inputType === 'NUMBER') {
      return (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(nextValue) => onChangeValue(entryId, nextValue)}
          placeholder={label}
          keyboardType="numeric"
        />
      );
    }

    if (inputType === 'CHECKBOX') {
      return (
        <Switch
          value={value === 'true'}
          onValueChange={(nextValue) => onChangeValue(entryId, String(nextValue))}
        />
      );
    }

    return (
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={value}
          onValueChange={(nextValue) => onChangeValue(entryId, String(nextValue))}
        >
          <Picker.Item label="Select value" value="" />
          {value !== '' ? <Picker.Item label={value} value={value} /> : null}
        </Picker>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        {label}
        {isMandatory ? ' *' : ''}
      </Text>

      {renderInput()}

      <TextInput
        style={styles.input}
        value={remarks ?? ''}
        onChangeText={(nextRemarks) => onChangeRemarks(entryId, nextRemarks)}
        placeholder="Remarks"
      />

      {isFlagged ? <Text style={styles.flag}>Flagged</Text> : null}

      {minValue !== null || maxValue !== null ? (
        <Text style={styles.meta}>
          Range: {minValue ?? '-'} to {maxValue ?? '-'}
        </Text>
      ) : null}

      {isFlagged ? (
        <View style={styles.uploadSection}>
          <Button
            title={isUploading ? 'Uploading...' : 'Upload Photo'}
            onPress={handleUploadPhoto}
            disabled={isUploading}
          />
          {isUploading ? <Text style={styles.uploadingText}>Uploading...</Text> : null}
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.preview} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    marginBottom: 8,
  },
  flag: {
    color: '#b91c1c',
    marginBottom: 4,
  },
  meta: {
    color: '#4b5563',
    fontSize: 12,
  },
  uploadSection: {
    marginTop: 8,
  },
  uploadingText: {
    marginTop: 8,
    color: '#4b5563',
  },
  preview: {
    width: 120,
    height: 120,
    marginTop: 8,
    borderRadius: 8,
  },
});
