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
import * as ImageManipulator from 'expo-image-manipulator';

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
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [material, setMaterial] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [nameOnDocument, setNameOnDocument] = useState('');

  const BACKEND_URL = API_CONFIG.API_URL; // Using centralized config
  const HUGGING_FACE_API_KEY = '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';
<<<<<<< HEAD

=======
>>>>>>> 2667e39b0ddcda8361b553bb8deac86406436472
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

  useEffect(() => {
    const getPermissions = async () => {
      // Request location permissions
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (locationPermission.status !== 'granted') {
        console.log('Location permission not granted');
      }

      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPermission.status !== 'granted') {
        console.log('Camera permission not granted');
      }

      // Request media library permissions
      const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaLibraryPermission.status !== 'granted') {
        console.log('Media library permission not granted');
      }
    };

    getPermissions();
  }, []);

  const launchCamera = async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Camera permission is required to take photos.');
      return;
    }

    try {
      // Launch camera without cropping
      let result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // No editing/cropping
        quality: 0.8,
        exif: false, // Don't need EXIF data
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImageUri = result.assets[0].uri;
        setPhoto(selectedImageUri);
        handleImageUpload(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const launchImageLibrary = async () => {
    // Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Media library permission is required to select photos.');
      return;
    }

    try {
      // Launch image library without cropping
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // No editing/cropping
        quality: 0.8,
        exif: false, // Don't need EXIF data
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImageUri = result.assets[0].uri;
        setPhoto(selectedImageUri);
        handleImageUpload(result.assets[0]);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Add this function to detect category from description
  const detectCategoryFromDescription = (description) => {
    const lowerDesc = description.toLowerCase();
    
    // Define keywords for each category
    const categoryKeywords = {
      'Electronics': ['phone', 'laptop', 'computer', 'tablet', 'ipad', 'iphone', 'android', 'samsung', 'charger', 'headphone', 'earbud', 'camera', 'watch', 'smart'],
      'Bags': ['bag', 'backpack', 'purse', 'handbag', 'luggage', 'suitcase', 'wallet', 'pouch', 'sack'],
      'Clothing': ['shirt', 'pant', 'jacket', 'coat', 'sweater', 'hoodie', 'dress', 'skirt', 'hat', 'cap', 'scarf', 'glove', 'sock', 'shoe', 'boot', 'sneaker', 'clothing', 'wear'],
      'Accessories': ['ring', 'necklace', 'bracelet', 'earring', 'jewelry', 'watch', 'glasses', 'sunglasses', 'umbrella', 'key', 'keychain'],
      'Documents': ['book', 'notebook', 'document', 'paper', 'card', 'id', 'passport', 'license', 'certificate', 'folder', 'file'],
    };
    
    // Check each category for matching keywords
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (lowerDesc.includes(keyword)) {
          return category;
        }
      }
    }
    
    // Default to 'Others' if no match found
    return 'Others';
  };

  // Add this function to generate item name from description
  const generateItemNameFromDescription = (description) => {
    // Split the description into words
    const words = description.split(/\s+/);
    
    // If description is short enough, use it directly
    if (words.length <= 5) {
      // Capitalize first letter
      return description.charAt(0).toUpperCase() + description.slice(1);
    }
    
    // Extract key nouns from the description
    const commonNouns = ['phone', 'wallet', 'bag', 'keys', 'watch', 'laptop', 'book', 'card', 'glasses', 'umbrella', 'camera', 'headphones', 'earbuds', 'ring', 'necklace', 'bracelet'];
    
    // Look for common nouns in the description
    for (const noun of commonNouns) {
      if (description.toLowerCase().includes(noun)) {
        // Find the adjectives before the noun (up to 2 words)
        const nounIndex = words.findIndex(word => word.toLowerCase().includes(noun));
        if (nounIndex > 0) {
          const startIndex = Math.max(0, nounIndex - 2);
          const itemNameWords = words.slice(startIndex, nounIndex + 1);
          return itemNameWords.join(' ').charAt(0).toUpperCase() + itemNameWords.join(' ').slice(1);
        }
        // If no adjectives, just use the noun with a prefix
        return `Found ${noun}`.charAt(0).toUpperCase() + `Found ${noun}`.slice(1);
      }
    }
    
    // If no common nouns found, use the first 3-4 words
    return words.slice(0, 4).join(' ').charAt(0).toUpperCase() + words.slice(0, 4).join(' ').slice(1);
  };

  const handleImageUpload = async (asset) => {
    if (!asset || !asset.uri) {
      console.error('No image asset provided');
      return;
    }

    setIsLoading(true);
    const huggingFaceUrl = 'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base';

    try {
      // Check image size
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      
      // If image is too large (> 5MB), compress it
      let imageUri = asset.uri;
      if (fileInfo.size > 5 * 1024 * 1024) {
        try {
          // Create a temporary compressed version
          const compressedUri = `${FileSystem.cacheDirectory}compressed_${Date.now()}.jpg`;
          const result = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 1200 } }], // Resize to reasonable width while maintaining aspect ratio
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          imageUri = result.uri;
          console.log('Image compressed successfully');
        } catch (compressionError) {
          console.error('Error compressing image:', compressionError);
          // Continue with original image if compression fails
        }
      }
      
      // Process image for description
      const base64ImageData = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const result = await axios.post(huggingFaceUrl, { inputs: base64ImageData }, {
        headers: {
          'Authorization': `Bearer ${HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      let generatedDescription = 'No description available';
      if (result.data && result.data[0] && result.data[0].generated_text) {
        generatedDescription = result.data[0].generated_text;
        setDescription(generatedDescription);
        
        // Auto-detect category if not already set
        if (!category) {
          const detectedCategory = detectCategoryFromDescription(generatedDescription);
          setCategory(detectedCategory);
        }
        
        // Auto-generate item name if not already set
        if (!itemName) {
          const generatedName = generateItemNameFromDescription(generatedDescription);
          setItemName(generatedName);
        }
      } else {
        setDescription(generatedDescription);
      }

    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process the image. Please try again.');
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
    if (!category) {
      Alert.alert('Error', 'Please select a category.');
      return;
    }
    if (!description) {
      Alert.alert('Error', 'Please provide a description.');
      return;
    }
    if (!itemName) {
      Alert.alert('Error', 'Please provide an item name.');
      return;
    }

    setIsLoading(true);

    try {
      // Get user ID from AsyncStorage
      const userData = await AsyncStorage.getItem('userData');
      let userId = null;
      
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        userId = parsedUserData._id;
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
      
      // Add category-specific attributes
      if (category === 'Electronics') {
        if (brand) formData.append('brand', brand);
        if (model) formData.append('model', model);
        if (color) formData.append('color', color);
        if (serialNumber) formData.append('serialNumber', serialNumber);
      } else if (category === 'Accessories') {
        if (brand) formData.append('brand', brand);
        if (material) formData.append('material', material);
        if (color) formData.append('color', color);
      } else if (category === 'Clothing') {
        if (brand) formData.append('brand', brand);
        if (size) formData.append('size', size);
        if (color) formData.append('color', color);
        if (material) formData.append('material', material);
      } else if (category === 'Documents') {
        if (documentType) formData.append('documentType', documentType);
        if (issuingAuthority) formData.append('issuingAuthority', issuingAuthority);
        if (nameOnDocument) formData.append('nameOnDocument', nameOnDocument);
      } else {
        // Others category - add any general attributes
        if (color) formData.append('color', color);
        if (brand) formData.append('brand', brand);
      }
      
      // Add user ID if available
      if (userId) {
        formData.append('userId', userId);
      }
      
      // Add coordinates if available
      if (selectedLocation) {
        formData.append('latitude', selectedLocation.latitude);
        formData.append('longitude', selectedLocation.longitude);
      }

      // Process photo if available
      if (photo) {
        // Check image size and compress if needed
        const fileInfo = await FileSystem.getInfoAsync(photo);
        let photoToUpload = photo;
        
        // If image is too large (> 2MB), compress it
        if (fileInfo.size > 2 * 1024 * 1024) {
          try {
            const result = await ImageManipulator.manipulateAsync(
              photo,
              [{ resize: { width: 1200 } }], // Resize to reasonable width while maintaining aspect ratio
              { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            photoToUpload = result.uri;
            console.log('Photo compressed for upload');
          } catch (compressionError) {
            console.error('Error compressing photo for upload:', compressionError);
            // Continue with original photo if compression fails
          }
        }
        
        // Fix URI for Android
        let photoUri = photoToUpload;
        if (Platform.OS === 'android' && !photoToUpload.startsWith('file://')) {
          photoUri = `file://${photoToUpload}`;
        }
        
        formData.append('photo', {
          uri: photoUri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        });
      }

      // Add to recent activity
      await addToRecentActivity();

      // Send the data to the backend
      const response = await axios.post(`${BACKEND_URL}/reportfound`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.status === 'success') {
        // Check if there are potential matches
        const matches = response.data.matches || [];
        
        if (matches.length > 0) {
          // Show success message with matches information
          Alert.alert(
            'Success!',
            `Your found item has been reported successfully. We found ${matches.length} potential matches!`,
            [
              {
                text: 'View Matches',
                onPress: () => {
                  // Reset form
                  setContact('');
                  setLocation('');
                  setPhoto(null);
                  setDescription('');
                  setTime(new Date());
                  setDate(new Date());
                  setCategory('');
                  setItemName('');
                  setBrand('');
                  setModel('');
                  setColor('');
                  setSize('');
                  setMaterial('');
                  setSerialNumber('');
                  setDocumentType('');
                  setIssuingAuthority('');
                  setNameOnDocument('');
                  
                  // Navigate to matches screen with the matches data
                  navigation.navigate('MatchesScreen', {
                    matches: matches,
                    foundItemId: response.data.itemId,
                    foundItemDescription: description
                  });
                },
              },
              {
                text: 'Later',
                onPress: () => {
                  // Reset form
                  setContact('');
                  setLocation('');
                  setPhoto(null);
                  setDescription('');
                  setTime(new Date());
                  setDate(new Date());
                  setCategory('');
                  setItemName('');
                  setBrand('');
                  setModel('');
                  setColor('');
                  setSize('');
                  setMaterial('');
                  setSerialNumber('');
                  setDocumentType('');
                  setIssuingAuthority('');
                  setNameOnDocument('');
                  // Navigate back to home
                  navigation.navigate('HomePage');
                },
              },
            ]
          );
        } else {
          // Show standard success message
          Alert.alert(
            'Success!',
            'Your found item has been reported successfully. Thank you for helping someone find their lost item!',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Reset form
                  setContact('');
                  setLocation('');
                  setPhoto(null);
                  setDescription('');
                  setTime(new Date());
                  setDate(new Date());
                  setCategory('');
                  setItemName('');
                  setBrand('');
                  setModel('');
                  setColor('');
                  setSize('');
                  setMaterial('');
                  setSerialNumber('');
                  setDocumentType('');
                  setIssuingAuthority('');
                  setNameOnDocument('');
                  // Navigate back to home
                  navigation.navigate('HomePage');
                },
              },
            ]
          );
        }
      } else {
        Alert.alert('Error', 'Failed to report found item. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting found item:', error);
      Alert.alert('Error', 'Failed to submit found item report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to reset all category-specific fields
  const resetCategoryFields = () => {
    setBrand('');
    setModel('');
    setColor('');
    setSerialNumber('');
    setMaterial('');
    setSize('');
    setDocumentType('');
    setIssuingAuthority('');
    setNameOnDocument('');
  };

  // Handler for category change
  const handleCategoryChange = (selectedCategory) => {
    setCategory(selectedCategory);
    resetCategoryFields();
  };

  // Render category-specific attribute fields
  const renderCategoryFields = () => {
    switch (category) {
      case 'Electronics':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Electronics Details</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Brand</Text>
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g., Apple, Samsung, Dell"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Model</Text>
              <TextInput
                style={styles.input}
                value={model}
                onChangeText={setModel}
                placeholder="e.g., iPhone 14 Pro, MacBook Air M2"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                value={color}
                onChangeText={setColor}
                placeholder="e.g., Silver, Black, Blue"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Serial Number (Optional)</Text>
              <TextInput
                style={styles.input}
                value={serialNumber}
                onChangeText={setSerialNumber}
                placeholder="Enter if visible for verification"
              />
            </View>
          </View>
        );
        
      case 'Accessories':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accessories Details</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Brand</Text>
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g., Gucci, Fossil, Herschel"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Material</Text>
              <TextInput
                style={styles.input}
                value={material}
                onChangeText={setMaterial}
                placeholder="e.g., Leather, Metal, Fabric"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                value={color}
                onChangeText={setColor}
                placeholder="e.g., Brown, Black, Tan"
              />
            </View>
          </View>
        );
        
      case 'Clothing':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clothing Details</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Brand</Text>
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="e.g., Nike, Adidas, Zara"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Size</Text>
              <TextInput
                style={styles.input}
                value={size}
                onChangeText={setSize}
                placeholder="e.g., S, M, L, XL, 42, 10"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                value={color}
                onChangeText={setColor}
                placeholder="e.g., Blue, Red, Black"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Material</Text>
              <TextInput
                style={styles.input}
                value={material}
                onChangeText={setMaterial}
                placeholder="e.g., Cotton, Polyester, Denim"
              />
            </View>
          </View>
        );
        
      case 'Documents':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Document Details</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Document Type</Text>
              <TextInput
                style={styles.input}
                value={documentType}
                onChangeText={setDocumentType}
                placeholder="e.g., Passport, Driver's License, Student ID"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Issuing Authority</Text>
              <TextInput
                style={styles.input}
                value={issuingAuthority}
                onChangeText={setIssuingAuthority}
                placeholder="e.g., Government, University, Company"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name on Document (Optional)</Text>
              <TextInput
                style={styles.input}
                value={nameOnDocument}
                onChangeText={setNameOnDocument}
                placeholder="Enter if visible for verification"
              />
            </View>
          </View>
        );
        
      case 'Others':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Details</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Brand (if applicable)</Text>
              <TextInput
                style={styles.input}
                value={brand}
                onChangeText={setBrand}
                placeholder="Enter if visible"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                value={color}
                onChangeText={setColor}
                placeholder="Enter the color of the item"
              />
            </View>
          </View>
        );
        
      default:
        return null;
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

        <View style={styles.photoButtonsContainer}>
          <TouchableOpacity onPress={() => launchCamera()} style={styles.cameraButton}>
            <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => launchImageLibrary()} style={styles.galleryButton}>
            <Ionicons name="images-outline" size={24} color="#FFFFFF" />
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>

        {photo && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: photo }} style={styles.imagePreview} />
            <TouchableOpacity 
              style={styles.removePhotoButton}
              onPress={() => {
                setPhoto(null);
                setDescription('');
              }}
            >
              <Ionicons name="close-circle" size={24} color="#FF3B30" />
            </TouchableOpacity>
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

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryContainer}>
            {['Electronics', 'Accessories', 'Clothing', 'Documents', 'Others'].map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.categoryButton,
                  category === item && styles.categoryButtonActive,
                ]}
                onPress={() => handleCategoryChange(item)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    category === item && styles.categoryButtonTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Render category-specific fields */}
        {category && renderCategoryFields()}

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
    position: 'relative',
    width: '100%',
    height: width * 0.7,
    marginBottom: height * 0.02,
    borderRadius: width * 0.03,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
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
  photoButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: height * 0.02,
    gap: width * 0.03,
  },
  cameraButton: {
    flex: 1,
    backgroundColor: '#3d0c45',
    padding: height * 0.015,
    borderRadius: width * 0.03,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  galleryButton: {
    flex: 1,
    backgroundColor: '#5a1c64',
    padding: height * 0.015,
    borderRadius: width * 0.03,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: width * 0.035,
    fontWeight: 'bold',
    marginLeft: width * 0.02,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 5,
    zIndex: 10,
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3d0c45',
    marginBottom: 15,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryButtonActive: {
    backgroundColor: '#3d0c45',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#333',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
});

export default ReportFoundItem;

