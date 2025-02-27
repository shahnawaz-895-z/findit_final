import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, Image, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { API_URL } from '@env';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

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

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const categories = ['Electronics', 'Bags', 'Clothing', 'Accessories', 'Documents', 'Others'];
  const BACKEND_URL = API_URL; 
  const HUGGING_FACE_API_KEY = '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'; // Replace with your API key

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

    setIsLoading(true);

    try {
        let photoData = null;
        if (photo) {
            // Convert photo to base64
            const base64 = await FileSystem.readAsStringAsync(photo, {
                encoding: FileSystem.EncodingType.Base64,
            });
            photoData = `data:image/jpeg;base64,${base64}`;
        }

        // Create the request body
        const requestBody = {
            contact,
            category,
            location,
            description,
            time: time.toISOString(),
            date: date.toISOString(),
            photo: photoData
        };

        // Make the API call using axios
        const response = await axios({
            method: 'POST',
            url: `${BACKEND_URL}/reportlost`,
            data: requestBody,
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.status === 200 || response.status === 201) {
            Alert.alert('Success', 'Report submitted successfully!');
            navigation.navigate('showfounditemdata', { 
                lostItemDescription: description 
            });
        } else {
            throw new Error('Server returned an unexpected status');
        }
    } catch (error) {
        console.error('Submission error:', error);
        Alert.alert(
            'Error', 
            `Failed to submit report: ${error.response?.data?.message || error.message}`
        );
    } finally {
        setIsLoading(false);
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
    navigation.navigate('lostitemreposting');
  };
 
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Report Lost Item</Text>

      <TouchableOpacity style={styles.noPictureButton} onPress={handleNoPicture}>
        <Ionicons name="document-text-outline" size={24} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.noPictureButtonText}>Report Without Photo</Text>
      </TouchableOpacity>

      <View style={styles.formSection}>
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
              keyboardType="numeric"
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
          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={24} color="#3d0c45" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter location"
              value={location}
              onChangeText={setLocation}
              placeholderTextColor="#666"
            />
          </View>
        </View>

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

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>SUBMIT REPORT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: width * 0.07,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: height * 0.03,
    color: '#3d0c45',
  },
  formSection: {
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
});

export default ReportLostItem;
