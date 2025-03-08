import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, TextInput, ScrollView, Alert, Platform, Dimensions, ActivityIndicator, Modal, SafeAreaView, StatusBar } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';

const { width, height } = Dimensions.get('window');
const ACTIVITY_STORAGE_KEY = 'user_activities'; // Same key as in Homepage.js

const ReportFoundItem = () => {
  const navigation = useNavigation();
  const [contact, setContact] = useState('');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState('');
  const [time, setTime] = useState(new Date());
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [geolocation, setGeolocation] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [itemName, setItemName] = useState('');
  const [fullScreenMap, setFullScreenMap] = useState(false);

  const BACKEND_URL = API_CONFIG.API_URL; // Using centralized config
  const HUGGING_FACE_API_KEY = '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';
  const categories = ['Electronics', 'Bags', 'Clothing', 'Accessories', 'Documents', 'Others'];

  useEffect(() => {
    const getLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to proceed.');
        return;
      }

      try {
        const userLocation = await Location.getCurrentPositionAsync({});
        setGeolocation(userLocation.coords);
        setSelectedLocation(userLocation.coords);
        const address = await Location.reverseGeocodeAsync(userLocation.coords);
        if (address && address.length > 0) {
          setLocation(`${address[0]?.city || ''}, ${address[0]?.region || ''}, ${address[0]?.country || ''}`);
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }
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

    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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

  const handleMapPress = (event) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });

    Location.reverseGeocodeAsync({ latitude, longitude }).then((addresses) => {
      if (addresses && addresses.length > 0) {
        const formattedAddress = `${addresses[0]?.name ? addresses[0].name + ', ' : ''}${addresses[0]?.street ? addresses[0].street + ', ' : ''}${addresses[0]?.city ? addresses[0].city + ', ' : ''}${addresses[0]?.region ? addresses[0].region + ', ' : ''}${addresses[0]?.country || ''}`;
        setLocation(formattedAddress.replace(/,\s*$/, ''));
      }
    });
  };

  const openFullScreenMap = () => {
    setFullScreenMap(true);
    setMapVisible(true);
  };

  const confirmLocation = () => {
    setFullScreenMap(false);
  };

  const detectCurrentLocation = async () => {
    try {
      setIsLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to proceed.');
        setIsLoading(false);
        return;
      }

      const userLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      setGeolocation(userLocation.coords);
      setSelectedLocation(userLocation.coords);
      
      const address = await Location.reverseGeocodeAsync(userLocation.coords);
      if (address && address.length > 0) {
        const formattedAddress = `${address[0]?.name ? address[0].name + ', ' : ''}${address[0]?.street ? address[0].street + ', ' : ''}${address[0]?.city ? address[0].city + ', ' : ''}${address[0]?.region ? address[0].region + ', ' : ''}${address[0]?.country || ''}`;
        setLocation(formattedAddress.replace(/,\s*$/, ''));
      }
      
      // Show the full screen map after detecting location
      setFullScreenMap(true);
      setMapVisible(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to detect current location. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!contact) {
      Alert.alert('Error', 'Please provide contact information.');
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Please provide the location.');
      return;
    }
    if (!time) {
      Alert.alert('Error', 'Please select a time.');
      return;
    }
    if (!date) {
      Alert.alert('Error', 'Please select a date.');
      return;
    }
    if (!description) {
      Alert.alert('Error', 'Please provide a description.');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location on the map.');
      return;
    }
    if (!itemName) {
      Alert.alert('Error', 'Please provide the item name.');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('contact', contact);
      formData.append('location', location);
      formData.append('time', time.toISOString());
      formData.append('date', date.toISOString());
      formData.append('description', description);
      formData.append('category', category);
      formData.append('latitude', selectedLocation.latitude);
      formData.append('longitude', selectedLocation.longitude);
      formData.append('itemName', itemName);

      if (photo) {
        let photoUri = photo;
        if (Platform.OS === 'android' && !photo.startsWith('file://')) {
          photoUri = `file://${photo}`;
        }

        formData.append('photo', {
          uri: photoUri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });
      }

      // Add to recent activity
      await addToRecentActivity();

      // For demo purposes, simulate a successful response
      setTimeout(() => {
        setIsLoading(false);
        Alert.alert(
          'Success',
          'Your found item has been reported successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('HomePage')
            }
          ]
        );
      }, 1500);
    } catch (error) {
      console.error('Error submitting found item:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to submit your report. Please try again.');
    }
  };

  // Add formatRelativeTime function
  const formatRelativeTime = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDay < 30) {
      return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
    } else {
      // Format as date if older than 30 days
      return date.toLocaleDateString();
    }
  };

  // Update addToRecentActivity function to include itemName and better time display
  const addToRecentActivity = async () => {
    try {
      // Format the date for display
      const now = new Date();
      const formattedDate = formatRelativeTime(now);
      
      // Create the activity object with actual item details
      const newActivity = {
        id: Date.now().toString(),
        type: 'found',
        title: itemName,
        status: 'pending',
        location: location,
        date: formattedDate,
        timestamp: now.toISOString(),
        category: category,
        photo: photo ? photo : null,
        description: description
      };
      
      // Get existing activities from AsyncStorage
      const storedActivities = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
      let activities = [];
      
      if (storedActivities) {
        activities = JSON.parse(storedActivities);
      }
      
      // Add new activity at the beginning
      activities.unshift(newActivity);
      
      // Store updated activities
      await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
      
      return newActivity;
    } catch (error) {
      console.error('Error adding to recent activity:', error);
      return null;
    }
  };

  return (
    <View style={styles.screenContainer}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Report Found Item</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="time-outline" size={24} color="#3d0c45" style={styles.icon} />
          <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.inputText}>
              {time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Select Time'}
            </Text>
          </TouchableOpacity>
        </View>
        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )}

        <View style={styles.inputContainer}>
          <Ionicons name="calendar-outline" size={24} color="#3d0c45" style={styles.icon} />
          <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.inputText}>
              {date ? date.toLocaleDateString() : 'Select Date'}
            </Text>
          </TouchableOpacity>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={24} color="#3d0c45" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Enter Contact Information"
            onChangeText={(text) => setContact(text)}
            value={contact}
            keyboardType="phone-pad"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="list-outline" size={24} color="#3d0c45" style={styles.icon} />
          <Picker
            selectedValue={category}
            onValueChange={(itemValue) => setCategory(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select Category" value="" />
            {categories.map((item, index) => (
              <Picker.Item key={index} label={item} value={item} />
            ))}
          </Picker>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="location-outline" size={24} color="#3d0c45" style={styles.icon} />
          <View style={styles.locationWrapper}>
            <TouchableOpacity style={[styles.input, { flex: 1 }]} onPress={openFullScreenMap}>
              <Text style={styles.inputText}>
                {location || 'Tap to select location'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.detectLocationButton}
              onPress={detectCurrentLocation}
              disabled={isLoading}
            >
              <Ionicons name="locate" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3d0c45" />
            <Text style={styles.loadingText}>Detecting location...</Text>
          </View>
        )}

        {/* Full Screen Map Modal */}
        <Modal
          visible={fullScreenMap}
          animationType="slide"
          onRequestClose={() => setFullScreenMap(false)}
        >
          <SafeAreaView style={styles.fullMapContainer}>
            <View style={styles.mapHeader}>
              <TouchableOpacity 
                style={styles.mapBackButton}
                onPress={() => setFullScreenMap(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#3d0c45" />
                <Text style={styles.mapHeaderText}>Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.mapLocateButton}
                onPress={detectCurrentLocation}
              >
                <Ionicons name="locate" size={24} color="#3d0c45" />
              </TouchableOpacity>
            </View>
            
            <MapView
              style={styles.fullMap}
              region={{
                latitude: selectedLocation?.latitude || geolocation?.latitude || 37.78825,
                longitude: selectedLocation?.longitude || geolocation?.longitude || -122.4324,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
            >
              {selectedLocation && (
                <Marker coordinate={selectedLocation} title="Selected Location" />
              )}
            </MapView>
            
            <View style={styles.mapFooter}>
              <Text style={styles.selectedLocationText} numberOfLines={2}>
                {location || 'No location selected'}
              </Text>
              <TouchableOpacity 
                style={styles.confirmLocationButton}
                onPress={confirmLocation}
              >
                <Text style={styles.confirmLocationText}>Use This Location</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>

        <TouchableOpacity onPress={pickImage} style={styles.pickImageButton}>
          <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
          <Text style={styles.pickImageText}>Add Photo</Text>
        </TouchableOpacity>

        {photo && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: photo }} style={styles.imagePreview} />
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color="#3d0c45" style={styles.loader} />
        ) : description ? (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>AI-Generated Description:</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholder="Edit description if needed"
              placeholderTextColor="#666"
            />
          </View>
        ) : (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>Description:</Text>
            <TextInput
              style={styles.descriptionInput}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholder="Enter description of the found item"
              placeholderTextColor="#666"
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Item Name:</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="pricetag-outline" size={24} color="#3d0c45" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter item name (e.g., Blue Keys)"
              value={itemName}
              onChangeText={setItemName}
              placeholderTextColor="#666"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.submitButton} 
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: width * 0.05,
  },
  heading: {
    fontSize: width * 0.07,
    fontWeight: 'bold',
    marginBottom: height * 0.03,
    textAlign: 'center',
    color: '#3d0c45',
    marginTop: height * 0.02,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: height * 0.02,
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(61, 12, 69, 0.1)',
  },
  icon: {
    marginLeft: width * 0.04,
    marginRight: width * 0.02,
  },
  input: {
    flex: 1,
    padding: width * 0.04,
    color: '#333',
    fontSize: width * 0.04,
  },
  inputText: {
    color: '#333',
    fontSize: width * 0.04,
  },
  picker: {
    flex: 1,
    height: height * 0.06,
  },
  map: {
    width: '100%',
    height: height * 0.25,
    marginBottom: height * 0.025,
    borderRadius: width * 0.03,
    overflow: 'hidden',
  },
  pickImageButton: {
    backgroundColor: '#3d0c45',
    padding: height * 0.02,
    borderRadius: width * 0.03,
    marginVertical: height * 0.02,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pickImageText: {
    color: '#FFFFFF',
    fontSize: width * 0.045,
    fontWeight: 'bold',
    marginLeft: width * 0.02,
  },
  imagePreviewContainer: {
    borderRadius: width * 0.03,
    overflow: 'hidden',
    marginBottom: height * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imagePreview: {
    width: '100%',
    height: height * 0.3,
    borderRadius: width * 0.03,
  },
  descriptionContainer: {
    backgroundColor: '#FFFFFF',
    padding: width * 0.04,
    borderRadius: width * 0.03,
    marginBottom: height * 0.02,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(61, 12, 69, 0.1)',
  },
  descriptionLabel: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#3d0c45',
    marginBottom: height * 0.01,
  },
  descriptionText: {
    fontSize: width * 0.04,
    color: '#333',
    lineHeight: width * 0.06,
  },
  descriptionInput: {
    fontSize: width * 0.04,
    color: '#333',
    textAlignVertical: 'top',
    minHeight: height * 0.1,
  },
  submitButton: {
    backgroundColor: '#3d0c45',
    padding: height * 0.02,
    borderRadius: width * 0.03,
    alignItems: 'center',
    marginTop: height * 0.02,
    marginBottom: height * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.045,
    fontWeight: 'bold',
  },
  loader: {
    marginVertical: height * 0.03,
  },
  inputGroup: {
    marginBottom: height * 0.02,
  },
  label: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#3d0c45',
    marginBottom: height * 0.01,
  },
  inputIcon: {
    marginLeft: width * 0.04,
    marginRight: width * 0.02,
  },
  locationWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detectLocationButton: {
    backgroundColor: '#3d0c45',
    borderRadius: 8,
    padding: 12,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    color: '#3d0c45',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullMapContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    zIndex: 10,
  },
  mapBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
  },
  mapHeaderText: {
    fontSize: 16,
    marginLeft: 5,
    color: '#3d0c45',
    fontWeight: 'bold',
  },
  mapLocateButton: {
    padding: 10,
  },
  fullMap: {
    flex: 1,
    width: '100%',
  },
  mapFooter: {
    backgroundColor: '#fff',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  selectedLocationText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  confirmLocationButton: {
    backgroundColor: '#3d0c45',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmLocationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ReportFoundItem;

