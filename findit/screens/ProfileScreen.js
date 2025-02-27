import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';

const SERVER_URL = 'http://192.168.18.18:5000'; // Update with your server URL

const { width, height } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedMobile, setEditedMobile] = useState('');
  const [newImage, setNewImage] = useState(null);

  useEffect(() => {
    loadUserData();
    requestPermissions();
  }, []);

  // Move navigation options setup to its own useEffect
  useEffect(() => {
    const setNavigationOptions = () => {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              if (isEditing) {
                setNewImage(null);
                setEditedName(userData?.name || '');
                setEditedMobile(userData?.mobile || '');
              }
              setIsEditing(!isEditing);
            }}
            style={styles.editButton}
          >
            <Icon
              name={isEditing ? "close" : "pencil"}
              size={24}
              color="#3b0b40"
            />
          </TouchableOpacity>
        ),
        headerTitle: 'Profile',
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
        },
      });
    };

    setNavigationOptions();
  }, [navigation, isEditing, userData]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to update your profile picture.');
      }
    }
  };

  const pickImage = async () => {
    if (!isEditing) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        console.log('Selected image URI:', uri);

        // Get file extension and create file name
        const fileExtension = uri.split('.').pop();
        const fileName = `profile.${fileExtension}`;

        setNewImage({
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          type: `image/${fileExtension}`,
          name: fileName,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (userDataString) {
        const parsedData = JSON.parse(userDataString);
        setUserData(parsedData);
        setEditedName(parsedData.name || '');
        setEditedMobile(parsedData.mobile || '');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      if (!userData || !userData._id) {
        Alert.alert('Error', 'User data is missing');
        return;
      }

      const formData = new FormData();
      formData.append('name', editedName);
      formData.append('email', userData.email);
      formData.append('mobile', editedMobile);

      // Log FormData contents for debugging
      console.log('FormData contents before image:', [...formData]);

      if (newImage) {
        console.log('Appending image to FormData:', newImage);
        formData.append('profileImage', {
          uri: newImage.uri,
          type: newImage.type,
          name: newImage.name,
        });
      }

      // Log the complete FormData
      //console.log('Complete FormData:', [...formData]);

      // Log the request URL
      const requestUrl = `${SERVER_URL}/profile/${userData._id}`;
      console.log('Making request to:', requestUrl);

      const response = await fetch(requestUrl, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      console.log('Response status:', response.status);

      const result = await response.json();
      console.log('Response data:', result);

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update profile');
      }

      // Update local storage with the new data
      const updatedUserData = {
        ...userData,
        name: editedName,
        mobile: editedMobile,
        ...(result.user || {}),
      };

      await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
      setUserData(updatedUserData);
      setIsEditing(false);
      setNewImage(null);

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert(
        'Error',
        `Failed to update profile: ${error.message}\nPlease check your network connection and try again.`
      );
    }
  };
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userData');
      navigation.replace('Login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.profileContainer}>
        <TouchableOpacity
          onPress={pickImage}
          disabled={!isEditing}
          style={[styles.imageContainer, isEditing && styles.imageContainerEditing]}
        >
          {(newImage?.uri || userData?.profileImage) ? (
            <Image
              source={{
                uri: newImage
                  ? newImage.uri
                  : `data:${userData.profileImageType};base64,${userData.profileImage}`
              }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Icon name="account" size={60} color="#666" />
            </View>
          )}
          {isEditing && (
            <View style={styles.editOverlay}>
              <Icon name="camera" size={24} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        {isEditing ? (
          <TextInput
            style={styles.nameInput}
            value={editedName}
            onChangeText={setEditedName}
            placeholder="Your name"
          />
        ) : (
          <Text style={styles.name}>{userData?.name || 'User Name'}</Text>
        )}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoItem}>
          <Icon name="email-outline" size={24} color="#666" />
          <Text style={styles.infoText}>{userData?.email || 'email@example.com'}</Text>
        </View>

        <View style={styles.infoItem}>
          <Icon name="phone-outline" size={24} color="#666" />
          {isEditing ? (
            <TextInput
              style={styles.mobileInput}
              value={editedMobile}
              onChangeText={setEditedMobile}
              placeholder="Your mobile number"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.infoText}>{userData?.mobile || 'Phone number'}</Text>
          )}
        </View>
      </View>

      {isEditing && (
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={24} color="#fff" style={styles.logoutIcon} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    padding: 10,
    marginRight: 10,
  },
  profileContainer: {
    alignItems: 'center',
    paddingTop: height * 0.03,
    paddingBottom: height * 0.04,
  },
  imageContainer: {
    position: 'relative',
    width: width * 0.3,
    height: width * 0.3,
    marginBottom: height * 0.02,
  },
  profileImage: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15,
  },
  profileImagePlaceholder: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainerEditing: {
    opacity: 0.8,
  },
  editOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: width * 0.15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#3b0b40',
  },
  nameInput: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#3b0b40',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3b0b40',
    paddingBottom: height * 0.01,
    minWidth: width * 0.5,
  },
  infoContainer: {
    paddingHorizontal: width * 0.05,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: width * 0.04,
    borderRadius: width * 0.02,
    marginBottom: height * 0.02,
  },
  infoText: {
    marginLeft: width * 0.04,
    fontSize: width * 0.04,
    color: '#333',
    flex: 1,
  },
  mobileInput: {
    marginLeft: width * 0.04,
    fontSize: width * 0.04,
    color: '#333',
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#3b0b40',
    paddingBottom: height * 0.01,
  },
  saveButton: {
    backgroundColor: '#3b0b40',
    marginHorizontal: width * 0.05,
    paddingVertical: height * 0.02,
    borderRadius: width * 0.02,
    alignItems: 'center',
    marginTop: height * 0.03,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: width * 0.04,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#3b0b40',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: width * 0.05,
    paddingVertical: height * 0.02,
    borderRadius: width * 0.02,
    marginTop: 'auto',
    marginBottom: height * 0.03,
  },
  logoutIcon: {
    marginRight: 10,
  },
  logoutText: {
    color: '#fff',
    fontSize: width * 0.04,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;