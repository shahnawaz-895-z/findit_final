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

const ProfileScreen = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('user');
      if (userDataString) {
        const parsedData = JSON.parse(userDataString);

        // ✅ Debugging Log: Check if profile image is correctly retrieved
        console.log('Profile Image URI:', parsedData.profileImage);

        setUserData(parsedData);
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

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      navigation.replace('Login');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  const getImageUri = () => {
    if (!userData?.profileImage) return null;

    console.log('🔹 Profile Image URI:', userData.profileImage.substring(0, 50)); // ✅ Log first 50 chars for debugging

    // ✅ Ensure Base64 string is correctly formatted
    if (!userData.profileImage.startsWith('data:image')) {
      console.error("❌ Invalid Image URI:", userData.profileImage);
      return null;
    }

    return userData.profileImage; // ✅ Correctly formatted Base64 image
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
          <Text style={styles.name}>{userData?.name || 'User'}</Text>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Icon name="mail-outline" size={24} color="#3b0b40" />
            <Text style={styles.infoText}>{userData?.email || 'No email provided'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="call-outline" size={24} color="#3b0b40" />
            <Text style={styles.infoText}>{userData?.mobile || 'No contact provided'}</Text>
          </View>
        </View>

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
});

export default ProfileScreen;
