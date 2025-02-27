import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Alert,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const HomePage = ({ navigation }) => {
  const handleReportLostItem = () => {
    navigation.navigate('ReportLostItem');
  };

  const handleReportFoundItem = () => {
    navigation.navigate('ReportFoundItem');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          onPress: () => {
            // Add any logout logic here (clear tokens etc)
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  const handleProfile = () => {
    navigation.navigate('ProfileScreen', {
      avatar: 'https://example.com/avatar.jpg',
      name: 'John Doe',
      emails: [{ email: 'john.doe@example.com', id: 1, name: 'Work' }],
      address: { city: 'New York', country: 'USA' },
    });
  };
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lost & Found</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Icon name="log-out-outline" size={24} color="#3d0c45" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Logo */}
        <Image
          source={require('../assets/logo.jpeg')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Main Buttons */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleReportLostItem}
        >
          <Icon name="search-outline" size={24} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>REPORT LOST ITEM</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleReportFoundItem}
        >
          <Icon name="add-circle-outline" size={24} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>REPORT FOUND ITEM</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem} onPress={() => { }}>
          <Icon name="home" size={24} color="#3d0c45" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem} onPress={() => navigation.navigate('SearchScreen')}>
          <Icon name="search" size={24} color="#666" />
          <Text style={styles.navText}>Search</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('ChatScreen')}>
          <Icon name="chatbubble-ellipses" size={24} color="#3d0c45" />
          <Text style={styles.navText}>Messages</Text>
        </TouchableOpacity>



        <TouchableOpacity
          style={styles.navItem}
          onPress={handleProfile}
        >
          <Icon name="person" size={24} color="#666" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: width * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingTop: height * 0.05, // Safe area for notch
  },
  headerTitle: {
    fontSize: width * 0.05,
    fontWeight: 'bold',
    color: '#3d0c45',
  },
  logoutButton: {
    padding: 8,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: width * 0.05,
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
    marginBottom: height * 0.05,
  },
  button: {
    backgroundColor: '#3d0c45',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: height * 0.02,
    paddingHorizontal: width * 0.08,
    borderRadius: width * 0.08,
    marginBottom: height * 0.025,
    width: '90%',
    elevation: 3,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: width * 0.04,
    fontWeight: 'bold',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: height * 0.015,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 5,
  },
  navItem: {
    alignItems: 'center',
    padding: width * 0.012,
  },
  navText: {
    fontSize: width * 0.03,
    marginTop: height * 0.005,
    color: '#666',
  },
});

export default HomePage;