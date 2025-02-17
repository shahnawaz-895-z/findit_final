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
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { Buffer } from 'buffer';

const ProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('user');
      if (userDataString) {
        const parsedData = JSON.parse(userDataString);
        // Pre-validate image data before setting state
        if (parsedData.profileImage) {
          try {
            const testImage = new Image();
            testImage.onerror = () => {
              console.error('Pre-validation: Image data is invalid');
              parsedData.profileImage = null;
            };
            testImage.src = `data:${parsedData.profileImageType};base64,${parsedData.profileImage}`;
          } catch (e) {
            console.error('Image pre-validation error:', e);
            parsedData.profileImage = null;
          }
        }
        setUserData(parsedData);
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
        <Text>No user data found.</Text>
      </View>
    );
  }

  const getImageUri = () => {
    if (!userData?.profileImage) return null;
    
    try {
      let cleanBase64 = userData.profileImage.trim();
      
      if (!cleanBase64.startsWith('data:')) {
        const mimeType = userData.profileImageType || 'image/jpeg';
        cleanBase64 = `data:${mimeType};base64,${cleanBase64}`;
      }
      
      if (!cleanBase64.match(/^data:image\/[a-z]+;base64,[A-Za-z0-9+/]+=*$/)) {
        console.error('Invalid image data URL format');
        return null;
      }
      
      return cleanBase64;
    } catch (e) {
      console.error('Error in getImageUri:', e);
      return null;
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          {!imageError && getImageUri() ? (
            <Image
              source={{ uri: getImageUri() }}
              style={styles.profileImage}
              onError={(e) => {
                console.error('Image loading error:', {
                  error: e.nativeEvent,
                  imageUri: getImageUri()?.substring(0, 100) + '...'
                });
                setImageError(true);
              }}
              onLoadStart={() => {
                setImageError(false);
                console.log('Starting to load image...');
              }}
              onLoad={() => {
                console.log('Image loaded successfully');
                setImageError(false);
              }}
              defaultSource={require('../assets/logo.jpeg')}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Icon name="person-outline" size={50} color="#666" />
            </View>
          )}
          <Text style={styles.name}>{userData?.name || 'User'}</Text>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Icon name="mail-outline" size={24} color="#3b0b40" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoText}>{userData.email}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <Icon name="call-outline" size={24} color="#3b0b40" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Contact Number</Text>
              <Text style={styles.infoText}>{userData.mobile || 'Not provided'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
  infoSection: {
    padding: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 10,
  },
  infoContent: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginTop: 4,
  },
  editButton: {
    backgroundColor: '#3b0b40',
    margin: 20,
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    margin: 20,
    marginTop: 0,
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default ProfileScreen;