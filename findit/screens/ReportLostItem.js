import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, Image, ScrollView, ActivityIndicator, Dimensions, Modal, SafeAreaView, StatusBar } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';

const { width, height } = Dimensions.get('window');
const ACTIVITY_STORAGE_KEY = 'user_activities'; // Same key as in Homepage.js

const ReportLostItem = () => {
  const navigation = useNavigation();
  const [time, setTime] = useState(new Date());
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [itemName, setItemName] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [geolocation, setGeolocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [fullScreenMap, setFullScreenMap] = useState(false);

  const categories = ['Electronics', 'Bags', 'Clothing', 'Accessories', 'Documents', 'Others'];
  const BACKEND_URL = API_CONFIG.API_URL; // Using centralized config
  const HUGGING_FACE_API_KEY = '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'; // Replace with your API key

  useEffect(() => {
    const getLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for better matching.');
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
      setPhoto(result.assets[0].uri);
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
      setDescription('');
    } finally {
      setIsLoading(false);
    }
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
        Alert.alert('Permission denied', 'Location permission is required for better matching.');
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
    if (!description) {
        Alert.alert('Error', 'Please provide a description.');
        return;
    }
    if (!contact) {
        Alert.alert('Error', 'Please provide contact information.');
        return;
    }
    if (!category) {
        Alert.alert('Error', 'Please select a category.');
        return;
    }
    if (!location) {
        Alert.alert('Error', 'Please provide the location.');
        return;
    }
    if (!itemName) {
        Alert.alert('Error', 'Please provide the item name.');
        return;
    }

    setIsLoading(true);

    try {
        let photoData = null;
        if (photo) {
            // Convert photo to base64
            const base64 = await FileSystem.readAsStringAsync(photo, {
                encoding: FileSystem.EncodingType.Base64,
            });
            photoData = base64;  // Remove the data URL prefix
        }

        // Create the request body
        const formData = new FormData();
        formData.append('contact', contact);
        formData.append('category', category);
        formData.append('location', location);
        formData.append('description', description);
        formData.append('time', time.toISOString());
        formData.append('date', date.toISOString());
        formData.append('itemName', itemName);
        
        // Add coordinates if available
        if (selectedLocation) {
            formData.append('latitude', selectedLocation.latitude);
            formData.append('longitude', selectedLocation.longitude);
        }
        
        if (photo) {
            formData.append('photo', {
                uri: photo,
                type: 'image/jpeg',
                name: 'photo.jpg',
            });
        }

        // Add to recent activity
        await addToRecentActivity();

        // In a real app, you would send this to your backend
        // const response = await axios.post(`${BACKEND_URL}/lostitem`, formData, {
        //     headers: {
        //         'Content-Type': 'multipart/form-data',
        //     },
        // });

        // For demo purposes, simulate a successful response
        setTimeout(() => {
            setIsLoading(false);
            Alert.alert(
                'Success',
                'Your lost item has been reported successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('HomePage')
                    }
                ]
            );
        }, 1500);
    } catch (error) {
        console.error('Error submitting lost item:', error);
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
            type: 'lost',
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

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const onChangeTime = (event, selectedTime) => {
    const currentTime = selectedTime || time;
    setShowTimePicker(Platform.OS === 'ios');
    setTime(currentTime);
  };

  const handleNoPicture = () => {
    // Just continue with the form without requiring a photo
    Alert.alert('Info', 'You can submit the form without a photo. Just fill in all other details.');
  };
 
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Lost Item</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Item Name:</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="pricetag-outline" size={24} color="#3d0c45" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter item name "
              value={itemName}
              onChangeText={setItemName}
              placeholderTextColor="#666"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description:</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="document-text-outline" size={24} color="#3d0c45" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Describe your lost item"
              value={description}
              onChangeText={setDescription}
              multiline
              placeholderTextColor="#666"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Time:</Text>
          <TouchableOpacity style={styles.inputContainer} onPress={() => setShowTimePicker(true)}>
            <Ionicons name="time-outline" size={24} color="#3d0c45" style={styles.inputIcon} />
            <Text style={styles.inputText}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>
        {showTimePicker && (
          <DateTimePicker
            value={time}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={onChangeTime}
          />
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contact:</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={24} color="#3d0c45" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter contact number"
              keyboardType="phone-pad"
              value={contact}
              onChangeText={setContact}
              placeholderTextColor="#666"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category:</Text>
          <View style={styles.pickerContainer}>
            <Ionicons name="list-outline" size={24} color="#3d0c45" style={styles.inputIcon} />
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
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date:</Text>
          <TouchableOpacity style={styles.inputContainer} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={24} color="#3d0c45" style={styles.inputIcon} />
            <Text style={styles.inputText}>{date.toDateString()}</Text>
          </TouchableOpacity>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onChangeDate}
          />
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location:</Text>
          <View style={styles.locationContainer}>
            <TouchableOpacity 
              style={[styles.inputContainer, { flex: 1 }]} 
              onPress={openFullScreenMap}
            >
              <Ionicons name="location-outline" size={24} color="#3d0c45" style={styles.inputIcon} />
              <Text style={styles.inputText}>
                {location || 'Tap to select location on map'}
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Upload Photo:</Text>
          <TouchableOpacity onPress={pickImage} style={styles.uploadButton}>
            <Ionicons name="camera-outline" size={24} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.uploadButtonText}>Choose Photo</Text>
          </TouchableOpacity>
          {photo && (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: photo }} style={styles.image} />
            </View>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description:</Text>
          {isLoading ? (
            <ActivityIndicator size="large" color="#3d0c45" style={styles.loader} />
          ) : (
            <View style={[styles.inputContainer, styles.descriptionContainer]}>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                placeholder="Enter description"
                value={description}
                onChangeText={setDescription}
                multiline
                editable={!isLoading}
                placeholderTextColor="#666"
              />
            </View>
          )}
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
          <Text style={styles.submitButtonText}>SUBMIT REPORT</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: width * 0.05,
  },
  backButton: {
    padding: width * 0.02,
  },
  headerTitle: {
    fontSize: width * 0.07,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    color: '#3d0c45',
  },
  formContainer: {
    padding: width * 0.05,
  },
  inputGroup: {
    marginBottom: height * 0.025,
  },
  label: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#3d0c45',
    marginBottom: height * 0.01,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: width * 0.03,
    borderWidth: 1,
    borderColor: 'rgba(61, 12, 69, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputIcon: {
    padding: width * 0.03,
  },
  input: {
    flex: 1,
    padding: width * 0.03,
    color: '#333',
    fontSize: width * 0.04,
  },
  inputText: {
    flex: 1,
    padding: width * 0.03,
    color: '#333',
    fontSize: width * 0.04,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: width * 0.03,
    borderWidth: 1,
    borderColor: 'rgba(61, 12, 69, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  picker: {
    flex: 1,
    height: height * 0.06,
  },
  uploadButton: {
    backgroundColor: '#3d0c45',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: height * 0.02,
    borderRadius: width * 0.03,
    marginTop: height * 0.01,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonIcon: {
    marginRight: width * 0.02,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: width * 0.045,
    fontWeight: 'bold',
  },
  imagePreviewContainer: {
    marginTop: height * 0.02,
    borderRadius: width * 0.03,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: width * 0.6,
    borderRadius: width * 0.03,
  },
  descriptionContainer: {
    minHeight: height * 0.15,
  },
  descriptionInput: {
    textAlignVertical: 'top',
  },
  loader: {
    marginVertical: height * 0.02,
  },
  noPictureButton: {
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: width * 0.05,
    padding: height * 0.02,
    borderRadius: width * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  noPictureButtonText: {
    color: '#fff',
    fontSize: width * 0.045,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#3d0c45',
    margin: width * 0.05,
    padding: height * 0.02,
    borderRadius: width * 0.03,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: width * 0.045,
    fontWeight: 'bold',
  },
  map: {
    width: '100%',
    height: height * 0.25,
    marginBottom: height * 0.025,
    borderRadius: width * 0.03,
    overflow: 'hidden',
  },
  locationContainer: {
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

export default ReportLostItem;
