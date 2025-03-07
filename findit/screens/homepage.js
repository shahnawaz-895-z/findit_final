import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Alert,
  Modal,
  FlatList,
  StatusBar,
  Platform,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Get status bar height to ensure proper padding on all devices
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const HomePage = ({ navigation }) => {
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // Sample notifications data
  const notifications = [
    { id: '1', title: 'New Match', message: 'Your lost item matches with a found item', time: '2 mins ago', read: false },
    { id: '2', title: 'Message Received', message: 'You have a new message from Sarah', time: '1 hour ago', read: false },
    { id: '3', title: 'Item Returned', message: 'John has marked your item as returned', time: '3 hours ago', read: true },
    { id: '4', title: 'Claim Approved', message: 'Your claim for the lost watch has been approved', time: 'Yesterday', read: true },
    { id: '5', title: 'Welcome!', message: 'Welcome to Lost & Found app', time: '3 days ago', read: true },
  ];

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

  const toggleNotifications = () => {
    setNotificationVisible(!notificationVisible);
  };

  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.notificationItem, 
        !item.read && styles.unreadNotification
      ]}
    >
      <View style={styles.notificationIcon}>
        <Icon 
          name={item.read ? "notifications-outline" : "notifications"} 
          size={24} 
          color={item.read ? "#666" : "#3d0c45"} 
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>{item.time}</Text>
      </View>
    </TouchableOpacity>
  );

  // Custom StatusBar component to ensure visibility
  const CustomStatusBar = ({backgroundColor, ...props}) => (
    <View style={[styles.statusBar, { backgroundColor }]}>
      <StatusBar translucent backgroundColor={backgroundColor} {...props} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Custom Status Bar */}
      <CustomStatusBar backgroundColor="#3d0c45" barStyle="light-content" />
      
      {/* Top Header - Explicitly set with proper height and padding */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Lost & Found</Text>
        <TouchableOpacity onPress={toggleNotifications} style={styles.notificationButton}>
          <Icon name="notifications-outline" size={24} color="#fff" />
          {/* Notification Badge */}
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>2</Text>
          </View>
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
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Icon name="home" size={24} color="#3d0c45" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem} onPress={() => navigation.navigate('SearchScreen')}>
          <Icon name="search" size={24} color="#666" />
          <Text style={styles.navText}>Search</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('ChatListScreen')}>
          <View style={styles.iconContainer}>
            <Icon name="chatbubble-ellipses" size={24} color="#666" />
            {unreadMessages > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
              </View>
            )}
          </View>
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

      {/* Notification Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={notificationVisible}
        onRequestClose={() => {
          setNotificationVisible(false);
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setNotificationVisible(false)}
        >
          <View style={styles.notificationContainer}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationHeaderTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotificationVisible(false)}>
                <Icon name="close" size={24} color="#3d0c45" />
              </TouchableOpacity>
            </View>
            <View style={styles.notificationOptions}>
              <TouchableOpacity style={styles.notificationOptionActive}>
                <Text style={styles.notificationOptionTextActive}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.notificationOption}>
                <Text style={styles.notificationOptionText}>Unread</Text>
              </TouchableOpacity>
            </View>
            {notifications.length > 0 ? (
              <FlatList
                data={notifications}
                renderItem={renderNotificationItem}
                keyExtractor={item => item.id}
                style={styles.notificationList}
              />
            ) : (
              <View style={styles.emptyNotifications}>
                <Icon name="notifications-off-outline" size={48} color="#ccc" />
                <Text style={styles.emptyNotificationsText}>No notifications yet</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // Status bar specific styles to ensure proper height
  statusBar: {
    height: STATUSBAR_HEIGHT,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3d0c45',
    paddingTop: Platform.OS === 'ios' ? 10 : 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
    height: Platform.OS === 'ios' ? 60 : 56,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    right: 4,
    top: 4,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
  
  // Notification modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  notificationContainer: {
    backgroundColor: '#fff',
    height: '60%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  notificationHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3d0c45',
  },
  notificationOptions: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  notificationOption: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
  },
  notificationOptionText: {
    color: '#666',
  },
  notificationOptionActive: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#3d0c45',
  },
  notificationOptionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  notificationList: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  unreadNotification: {
    backgroundColor: 'rgba(61, 12, 69, 0.05)',
  },
  notificationIcon: {
    paddingRight: 16,
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#3d0c45',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888',
  },
  emptyNotifications: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyNotificationsText: {
    marginTop: 10,
    fontSize: 16,
    color: '#888',
  },
  iconContainer: {
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default HomePage;