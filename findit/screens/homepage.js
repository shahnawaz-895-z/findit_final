import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const HomePage = ({ route, navigation }) => {
  const user = route.params?.user; // Ensure user data is received

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
            navigation.replace('Login');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      {user.profileImageUrl && (
        <Image
          source={{ uri: user.profileImageUrl }}
          style={styles.profileImage}
        />
      )}
      <Text style={styles.welcomeText}>Welcome, {user.name}!</Text>
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lost & Found</Text>
        <TouchableOpacity onPress={() => navigation.replace('Login')}>
          <Icon name="log-out-outline" size={24} color="#3d0c45" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Image
          source={require('../assets/logo.jpeg')}
          style={styles.logo}
          resizeMode="contain"
        />

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
          style={styles.navItem}
          onPress={() => navigation.navigate('Search')}
        >
          <Icon name="search" size={24} color="#666" />
          <Text style={styles.navText}>Search</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('Messages')}
        >
          <Icon name="chatbubble-ellipses" size={24} color="#666" />
          <Text style={styles.navText}>Messages</Text>
        </TouchableOpacity>

        {/* Navigate to Profile and Pass User Data */}
        <TouchableOpacity onPress={() => navigation.navigate('ProfileScreen', { user })}>
          <Icon name="person" size={30} color="black" />
          <Text>Profile</Text>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
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
    padding: 20,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#3d0c45',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 20,
    width: '90%',
    elevation: 3,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 5,
  },
  navItem: {
    alignItems: 'center',
    padding: 5,
  },
  navText: {
    fontSize: 12,
    marginTop: 4,
    color: '#666',
  },
});

export default HomePage;

