import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, TextInput, ScrollView, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

const ReportFoundItem = () => {
  const [contact, setContact] = useState('');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState('');
  const [time, setTime] = useState(null);
  const [date, setDate] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [geolocation, setGeolocation] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const HUGGING_FACE_API_KEY = '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';

  useEffect(() => {
    const getLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to proceed.');
        return;
      }

      const userLocation = await Location.getCurrentPositionAsync({});
      setGeolocation(userLocation.coords);
      const address = await Location.reverseGeocodeAsync(userLocation.coords);
      setLocation(`${address[0]?.city}, ${address[0]?.region}, ${address[0]?.country}`);
    };

    getLocationPermission();
  }, []);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission to access camera roll is required!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      maxWidth: 1000,
      maxHeight: 1000,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedImageUri = result.assets[0].uri;
      setPhoto(selectedImageUri);
      handleImageUpload(result.assets[0]);
    } else {
      Alert.alert('Image selection was cancelled or failed');
    }
  };

  const handleImageUpload = async (asset) => {
    if (!asset || !asset.uri) {
      console.error('No image asset provided');
      return;
    }

    const huggingFaceUrl = 'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base';

    try {
      const base64ImageData = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = await axios.post(huggingFaceUrl, { inputs: base64ImageData }, {
        headers: {
          'Authorization': `Bearer ${HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (result.data && result.data[0] && result.data[0].generated_text) {
        setDescription(result.data[0].generated_text);
      } else {
        setDescription('No description available');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error processing the image. Please try again.');
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) setTime(selectedTime);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  };

  const handleSubmit = async () => {
    if (!contact || !location || !time || !date || !photo || !description || !selectedLocation) {
      Alert.alert('Missing Information', 'Please fill in all fields and upload a photo.');
      return;
    }

    const formData = new FormData();
    formData.append('contact', contact);
    formData.append('location', location);
    formData.append('time', time ? time.toLocaleTimeString() : '');
    formData.append('date', date ? date.toLocaleDateString() : '');
    formData.append('description', description);
    formData.append('latitude', selectedLocation.latitude);
    formData.append('longitude', selectedLocation.longitude);

    if (photo) {
      let photoUri = photo;
      if (Platform.OS === 'android' && !photo.startsWith('file://')) {
        photoUri = `file://${photo}`;
      }

      formData.append('photo', {
        uri: photoUri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });
    }

    try {
      const response = await axios.post(`${API_URL}/reportfound`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Response:', response);
      if (response.data && response.data.status === 'success') {
        Alert.alert('Success', 'Found item reported successfully');
        // Clear the form after successful submission
        setContact('');
        setLocation('');
        setPhoto(null);
        setDescription('');
        setTime(null);
        setDate(null);
        setGeolocation(null);
        setSelectedLocation(null);
      } else {
        Alert.alert('Error', response.data.message || 'There was a problem reporting the found item');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      if (error.response) {
        Alert.alert('Error', `Server error: ${error.response.status}`);
      } else if (error.request) {
        Alert.alert('Error', 'No response received from the server');
      } else {
        Alert.alert('Error', 'An unexpected error occurred');
      }
    }
  };

  const handleMapPress = (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });

    Location.reverseGeocodeAsync({ latitude, longitude }).then((addresses) => {
      if (addresses && addresses.length > 0) {
        setLocation(`${addresses[0]?.city}, ${addresses[0]?.region}, ${addresses[0]?.country}`);
      }
    });
  };

  return (
    <View style={styles.screenContainer}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Report Found Item</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="time-outline" size={24} color="#4A90E2" style={styles.icon} />
          <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.inputText}>
              {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Select Time'}
            </Text>
          </TouchableOpacity>
        </View>
        {showTimePicker && (
          <DateTimePicker
            value={time || new Date()}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )}

        <View style={styles.inputContainer}>
          <Ionicons name="calendar-outline" size={24} color="#4A90E2" style={styles.icon} />
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.inputText}>
              {date ? date.toLocaleDateString() : 'Select Date'}
            </Text>
          </TouchableOpacity>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={date || new Date()}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={24} color="#4A90E2" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter Contact Information"
            onChangeText={(text) => setContact(text)}
            value={contact}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="location-outline" size={24} color="#4A90E2" style={styles.icon} />
          <TouchableOpacity style={styles.input} onPress={() => setMapVisible(!mapVisible)}>
            <Text style={styles.inputText}>
              {location || 'Tap to select location'}
            </Text>
          </TouchableOpacity>
        </View>

        {mapVisible && (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: geolocation?.latitude || 37.78825,
              longitude: geolocation?.longitude || -122.4324,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            onPress={handleMapPress}
          >
            {selectedLocation && (
              <Marker coordinate={selectedLocation} title="Selected Location" />
            )}
          </MapView>
        )}

        <TouchableOpacity onPress={pickImage} style={styles.pickImageButton}>
          <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
          <Text style={styles.pickImageText}>Pick Image</Text>
        </TouchableOpacity>

        {photo && <Image source={{ uri: photo }} style={styles.imagePreview} />}

        {description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionText}>Description: {description}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#2C3E50',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  icon: {
    marginLeft: 12,
    marginRight: 8,
  },
  input: {
    flex: 1,
    padding: 12,
  },
  inputText: {
    color: '#34495E',
    fontSize: 16,
  },
  map: {
    width: '100%',
    height: 200,
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pickImageButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickImageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  descriptionContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: '#34495E',
  },
  submitButton: {
    backgroundColor: '#3498DB',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ReportFoundItem;

