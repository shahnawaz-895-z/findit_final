import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const ReportFoundItemForm = ({ navigation }) => {
  const [formData, setFormData] = useState({
    itemName: '',
    time: '',
    contact: '',
    location: '',
    date: '',
    description: ''
  });
  const [photo, setPhoto] = useState(null);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);

  const locations = [
    { label: 'Select Location', value: '' },
    { label: 'Main Building', value: 'main_building' },
    { label: 'Library', value: 'library' },
    { label: 'Cafeteria', value: 'cafeteria' },
    { label: 'Parking Lot', value: 'parking' },
    { label: 'Sports Complex', value: 'sports' }
  ];

  const showTimePicker = () => setTimePickerVisible(true);
  const hideTimePicker = () => setTimePickerVisible(false);
  const showDatePicker = () => setDatePickerVisible(true);
  const hideDatePicker = () => setDatePickerVisible(false);

  const handleConfirmTime = useCallback((selectedTime) => {
    const hours = selectedTime.getHours();
    const minutes = selectedTime.getMinutes();
    const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    setFormData(prev => ({ ...prev, time: formattedTime }));
    hideTimePicker();
  }, []);

  const handleConfirmDate = useCallback((selectedDate) => {
    const formattedDate = selectedDate.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, date: formattedDate }));
    hideDatePicker();
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to upload photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, []);

  const validateForm = useCallback(() => {
    const requiredFields = ['itemName', 'location', 'date', 'time', 'contact'];
    const missingFields = requiredFields.filter(field => !formData[field]);

    if (missingFields.length > 0) {
      Alert.alert('Error', `Please fill in all required fields: ${missingFields.join(', ')}`);
      return false;
    }
    if (!photo) {
      Alert.alert('Error', 'Please upload an image of the found item');
      return false;
    }
    return true;
  }, [formData, photo]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    try {
      const formDataToSend = new FormData();
      
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value);
      });

      if (photo) {
        const photoFileName = photo.split('/').pop();
        const match = /\.(\w+)$/.exec(photoFileName);
        const type = match ? `image/${match[1]}` : 'image';

        formDataToSend.append('photo', {
          uri: photo,
          name: photoFileName,
          type
        });
      }

      const response = await fetch('http://192.168.100.247:5003/report-found', {
        method: 'POST',
        body: formDataToSend,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();

      if (data.status === 'success') {
        Alert.alert('Success', 'Item reported successfully!', [
          { text: 'OK', onPress: () => navigation.navigate('HomePage') }
        ]);
      } else {
        throw new Error(data.message || 'Failed to report item');
      }
    } catch (error) {
      console.error('Submission error:', error);
      Alert.alert('Error', error.message || 'Failed to submit report. Please try again.');
    }
  }, [formData, photo, navigation, validateForm]);

  const renderInput = useCallback((placeholder, key, keyboardType = 'default') => (
    <TextInput
      style={styles.input}
      placeholder={`${placeholder} *`}
      value={formData[key]}
      onChangeText={(text) => setFormData(prev => ({ ...prev, [key]: text }))}
      keyboardType={keyboardType}
    />
  ), [formData]);

  return (
    <View style={styles.screenContainer}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Report Found Item</Text>

        {renderInput('Item Name', 'itemName')}

        <TouchableOpacity style={styles.input} onPress={showTimePicker}>
          <Text style={{ color: formData.time ? '#000' : '#aaa' }}>
            {formData.time || 'Select Time *'}
          </Text>
        </TouchableOpacity>
        
        {renderInput('Contact', 'contact', 'phone-pad')}

        <Picker
          selectedValue={formData.location}
          style={styles.input}
          onValueChange={(itemValue) => setFormData(prev => ({ ...prev, location: itemValue }))}
        >
          {locations.map((loc) => (
            <Picker.Item key={loc.value} label={loc.label} value={loc.value} />
          ))}
        </Picker>

        <TouchableOpacity style={styles.input} onPress={showDatePicker}>
          <Text style={{ color: formData.date ? '#000' : '#aaa' }}>
            {formData.date || 'Select Date *'}
          </Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description"
          value={formData.description}
          onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
          multiline
          numberOfLines={4}
        />
        
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadText}>Upload Photo *</Text>
          <Icon name="cloud-upload-outline" size={24} color="#4A235A" />
        </TouchableOpacity>

        {photo && <Image source={{ uri: photo }} style={styles.image} />}
        
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Report</Text>
        </TouchableOpacity>
      </ScrollView>

      <DateTimePickerModal
        isVisible={isTimePickerVisible}
        mode="time"
        onConfirm={handleConfirmTime}
        onCancel={hideTimePicker}
      />
      
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 40,
    textAlign: 'center',
    color: '#4A235A',
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  uploadText: {
    color: '#4A235A',
    marginRight: 10,
    fontWeight: '500',
  },
  image: {
    width: '100%',
    height: 200,
    marginBottom: 15,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  submitButton: {
    backgroundColor: '#4A235A',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ReportFoundItemForm;