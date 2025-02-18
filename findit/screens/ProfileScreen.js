import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

const ProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedMobile, setEditedMobile] = useState('');

  const loadUserData = async () => {
    try {
      // Changed key from 'user' to 'userData' to match LoginScreen
      const userDataString = await AsyncStorage.getItem('userData');
      console.log('Retrieved user data string:', userDataString ? 'Data exists' : 'No data');
      
      if (userDataString) {
        const parsedData = JSON.parse(userDataString);
        console.log('Parsed data:', parsedData ? 'Successfully parsed' : 'Parse failed');

        // ✅ Debugging Log: Check if profile image is correctly retrieved
        console.log('Profile Image URI:', parsedData.profileImage ? 'Image exists' : 'No image');

        setUserData(parsedData);
        setEditedName(parsedData.name || '');
        setEditedMobile(parsedData.mobile || '');
      } else {
        console.log('No user data found in AsyncStorage');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
    const unsubscribe = navigation.addListener('focus', loadUserData);
    return unsubscribe;
  }, [navigation]);

  // Add header configuration with back button and edit button
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          style={{ marginLeft: 15 }} 
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#3b0b40" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity 
          style={{ marginRight: 15 }} 
          onPress={() => setIsEditing(!isEditing)}
        >
          <Icon name={isEditing ? "close" : "create-outline"} size={24} color="#3b0b40" />
        </TouchableOpacity>
      ),
      headerTitle: 'Profile',
    });
  }, [navigation, isEditing]);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userData');
      navigation.replace('Login');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  const handleSaveChanges = async () => {
    try {
      if (!userData || !userData._id) {
        Alert.alert('Error', 'User data is missing or incomplete');
        return;
      }

      // Prepare updated data
      const updatedData = {
        ...userData,
        name: editedName,
        mobile: editedMobile,
      };
      
      // Make API call to update user profile
      const response = await fetch(`http://192.168.18.18:5000/profile/${userData._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editedName,
          mobile: editedMobile,
        }),
      });
      
      if (response.ok) {
        // Update local storage with updated data
        await AsyncStorage.setItem('userData', JSON.stringify(updatedData));
        
        // Update state
        setUserData(updatedData);
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'An error occurred while updating profile');
    }
  };

  const getImageUri = () => {
    if (!userData?.profileImage) return null;

    // Format the profile image correctly
    let imageUri = userData.profileImage;
    
    // Add data URI prefix if not present
    if (typeof imageUri === 'string' && !imageUri.startsWith('data:image')) {
      const imageType = userData.profileImageType || 'image/jpeg';
      imageUri = `data:${imageType};base64,${imageUri}`;
    }
    
    console.log('🔹 Profile Image URI:', imageUri ? 'Valid image URI' : 'Invalid image URI');

    return imageUri;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b0b40" />
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Please log in to view your profile.</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          {!imageError && getImageUri() ? (
            <Image
              source={{ uri: getImageUri() }}
              style={styles.profileImage}
              onError={() => setImageError(true)}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Icon name="person-outline" size={50} color="#666" />
            </View>
          )}
          
          {isEditing ? (
            <TextInput
              style={styles.editInput}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Your name"
            />
          ) : (
            <Text style={styles.name}>{userData?.name || 'User'}</Text>
          )}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Icon name="mail-outline" size={24} color="#3b0b40" />
            <Text style={styles.infoText}>{userData?.email || 'No email provided'}</Text>
          </View>
          
          {isEditing ? (
            <View style={styles.infoItem}>
              <Icon name="call-outline" size={24} color="#3b0b40" />
              <TextInput
                style={styles.editInfoInput}
                value={editedMobile}
                onChangeText={setEditedMobile}
                placeholder="Your mobile number"
                keyboardType="phone-pad"
              />
            </View>
          ) : (
            <View style={styles.infoItem}>
              <Icon name="call-outline" size={24} color="#3b0b40" />
              <Text style={styles.infoText}>{userData?.mobile || 'No contact provided'}</Text>
            </View>
          )}
        </View>

        {isEditing && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="log-out-outline" size={24} color="#fff" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  placeholderImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b0b40',
  },
  infoContainer: {
    padding: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#3b0b40',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 20,
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loginButton: {
    backgroundColor: '#3b0b40',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    marginVertical: 5,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#3b0b40',
    backgroundColor: '#fff',
    width: '80%',
  },
  editInfoInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    padding: 5,
  },
  saveButton: {
    backgroundColor: '#3b0b40',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;