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
  Dimensions,
  ScrollView,
  ImageBackground,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// Constants
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;
const { width } = Dimensions.get('window');
const ACTIVITY_STORAGE_KEY = 'user_activities';

const HomePage = ({ navigation }) => {
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(2);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  
  // Sample notifications data
  const notifications = [
    { id: '1', title: 'New Match', message: 'Your lost item matches with a found item', time: '2 mins ago', read: false, type: 'match', itemId: '1' },
    { id: '2', title: 'Message Received', message: 'You have a new message from Sarah', time: '1 hour ago', read: false, type: 'message', chatId: '1' },
    { id: '3', title: 'Item Returned', message: 'John has marked your item as returned', time: '3 hours ago', read: true, type: 'return', itemId: '2' },
    { id: '4', title: 'Claim Approved', message: 'Your claim for the lost watch has been approved', time: 'Yesterday', read: true, type: 'claim', itemId: '3' },
    { id: '5', title: 'Welcome!', message: 'Welcome to Lost & Found app', time: '3 days ago', read: true, type: 'info' },
  ];

  // Activity data state
  const [recentActivity, setRecentActivity] = useState([]);

  // Fetch user data and activity on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsedUserData = JSON.parse(userData);
          setUserId(parsedUserData._id);
        }
        
        // Fetch activities from AsyncStorage
        await fetchActivitiesFromStorage();
      } catch (error) {
        console.error('Error fetching user data:', error);
        setDemoActivity();
        setLoading(false);
      }
    };

    fetchUserData();

    // Add listener for when the screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      // Refresh activities when screen is focused
      fetchActivitiesFromStorage();
    });

    // Clean up the listener when component unmounts
    return unsubscribe;
  }, [navigation]);

  // Fetch activities from AsyncStorage
  const fetchActivitiesFromStorage = async () => {
    try {
      setLoading(true);
      
      // Get activities from AsyncStorage
      const storedActivities = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
      
      if (storedActivities) {
        // Parse stored activities
        const parsedActivities = JSON.parse(storedActivities);
        
        // Sort by most recent first
        parsedActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Take only the 3 most recent activities for the homepage
        setRecentActivity(parsedActivities.slice(0, 3));
      } else {
        // If no stored activities, initialize with demo data
        await initializeActivities();
      }
    } catch (error) {
      console.error('Error fetching activities from storage:', error);
      setDemoActivity();
    } finally {
      setLoading(false);
    }
  };

  // Initialize activities with demo data and store in AsyncStorage
  const initializeActivities = async () => {
    try {
      const demoActivities = generateDemoActivities();
      
      // Store in AsyncStorage
      await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(demoActivities));
      
      // Set in state
      setRecentActivity(demoActivities.slice(0, 3));
    } catch (error) {
      console.error('Error initializing activities:', error);
      setDemoActivity();
    }
  };

  // Generate demo activity data
  const generateDemoActivities = () => {
    const demoActivities = [
      { 
        id: '1', 
        type: 'lost', 
        title: 'Blue Wallet', 
        date: '2 days ago', 
        status: 'pending', 
        location: 'University Library',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      { 
        id: '2', 
        type: 'found', 
        title: 'iPhone 13', 
        date: '1 week ago', 
        status: 'matched', 
        location: 'Central Park',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      { 
        id: '3', 
        type: 'lost', 
        title: 'Car Keys', 
        date: '3 days ago', 
        status: 'pending', 
        location: 'Shopping Mall',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      { 
        id: '4', 
        type: 'found', 
        title: 'Laptop Bag', 
        date: '5 days ago', 
        status: 'matched', 
        location: 'Coffee Shop',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      { 
        id: '5', 
        type: 'lost', 
        title: 'Headphones', 
        date: '1 week ago', 
        status: 'returned', 
        location: 'Gym',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Sort by most recent first
    demoActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return demoActivities;
  };

  // Set demo activity data (fallback)
  const setDemoActivity = () => {
    const demoActivities = generateDemoActivities();
    setRecentActivity(demoActivities.slice(0, 3));
  };

  // Add a new activity and store in AsyncStorage
  const addNewActivity = async (activity) => {
    try {
      // Generate a unique ID
      activity.id = Date.now().toString();
      
      // Add timestamp
      activity.timestamp = new Date().toISOString();
      
      // Format relative date (e.g., "2 mins ago")
      activity.date = 'Just now';
      
      // Get existing activities
      const storedActivities = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
      let activities = [];
      
      if (storedActivities) {
        activities = JSON.parse(storedActivities);
      }
      
      // Add new activity
      activities.unshift(activity);
      
      // Store updated activities
      await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
      
      // Update state with the 3 most recent activities
      setRecentActivity(activities.slice(0, 3));
      
      return activity;
    } catch (error) {
      console.error('Error adding new activity:', error);
      return null;
    }
  };

  // Update an existing activity
  const updateActivity = async (activityId, updates) => {
    try {
      // Get existing activities
      const storedActivities = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
      
      if (storedActivities) {
        let activities = JSON.parse(storedActivities);
        
        // Find and update the activity
        const updatedActivities = activities.map(activity => {
          if (activity.id === activityId) {
            return { ...activity, ...updates };
          }
          return activity;
        });
        
        // Store updated activities
        await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(updatedActivities));
        
        // Update state with the 3 most recent activities
        setRecentActivity(updatedActivities.slice(0, 3));
      }
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  const handleReportLostItem = () => {
    // Navigate to report lost item screen
    navigation.navigate('ReportLostItem');
  };

  const handleReportFoundItem = () => {
    // Navigate to report found item screen
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
    navigation.navigate('ProfileScreen');
  };

  const toggleNotifications = () => {
    setNotificationVisible(!notificationVisible);
  };

  const navigateToDashboard = () => {
    navigation.navigate('DashboardScreen');
  };

  const handleNotificationPress = (notification) => {
    setNotificationVisible(false);
    
    switch(notification.type) {
      case 'match':
        navigation.navigate('MatchDetailsScreen', { matchId: notification.itemId });
        break;
      case 'message':
        navigation.navigate('ChatScreen', { chatId: notification.chatId });
        break;
      case 'return':
      case 'claim':
        if (notification.itemId) {
          navigation.navigate('ReportLostItem', { itemId: notification.itemId, viewOnly: true });
        }
        break;
      case 'info':
      default:
        navigation.navigate('NotificationsScreen');
        break;
    }
  };

  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.notificationItem, 
        !item.read && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
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

  const renderActivityItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.activityItem}
      onPress={() => {
        if (item.type === 'lost') {
          navigation.navigate('ReportLostItem', { itemId: item.id, viewOnly: true });
        } else if (item.type === 'found') {
          navigation.navigate('ReportFoundItem', { itemId: item.id, viewOnly: true });
        } else if (item.status === 'matched' || item.type === 'match') {
          // If it's a matched item, navigate to match details
          navigation.navigate('MatchDetailsScreen', { 
            match: {
              id: `match-${item.id}`,
              lostItemId: item.id,
              foundItemId: `found-${item.id}`,
              lostItemDescription: item.title,
              foundItemDescription: `Found ${item.title}`,
              foundLocation: item.location,
              foundDate: item.timestamp,
              matchConfidence: 85,
              status: item.status,
              foundByUser: {
                id: 'u2',
                name: item.reportedBy || 'Jane Smith',
                avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
              }
            }
          });
        }
      }}
    >
      <View style={[styles.activityIconContainer, { 
        backgroundColor: getActivityIconBackground(item)
      }]}>
        <Icon 
          name={getActivityIcon(item)} 
          size={20} 
          color={getActivityIconColor(item)} 
        />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        {item.description && (
          <Text style={styles.activityDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <Text style={styles.activityDate}>
          {item.date} • {item.location}
        </Text>
      </View>
      <View style={[styles.activityStatus, { 
        backgroundColor: getStatusColor(item.status).bg,
      }]}>
        <Text style={[styles.activityStatusText, { 
          color: getStatusColor(item.status).text,
        }]}>
          {capitalizeFirstLetter(item.status)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Helper function to get activity icon
  const getActivityIcon = (item) => {
    if (item.type === 'lost') return "search-outline";
    if (item.type === 'found') return "checkmark-circle-outline";
    if (item.type === 'match') return "git-compare-outline";
    return "document-text-outline";
  };

  // Helper function to get activity icon background
  const getActivityIconBackground = (item) => {
    if (item.type === 'lost') return '#f8d7da';
    if (item.type === 'found') return '#d1e7dd';
    if (item.type === 'match') return '#cce5ff';
    return '#e2e3e5';
  };

  // Helper function to get activity icon color
  const getActivityIconColor = (item) => {
    if (item.type === 'lost') return '#dc3545';
    if (item.type === 'found') return '#198754';
    if (item.type === 'match') return '#0d6efd';
    return '#383d41';
  };

  // Helper function to get status colors
  const getStatusColor = (status) => {
    switch(status) {
      case 'pending':
        return { bg: '#fff3cd', text: '#856404' };
      case 'matched':
        return { bg: '#d1e7dd', text: '#155724' };
      case 'returned':
        return { bg: '#cce5ff', text: '#004085' };
      case 'claimed':
        return { bg: '#d4edda', text: '#155724' };
      case 'unclaimed':
        return { bg: '#f8d7da', text: '#721c24' };
      default:
        return { bg: '#e2e3e5', text: '#383d41' };
    }
  };

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

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
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={navigateToDashboard} style={styles.dashboardButton}>
            <Icon name="stats-chart" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('NotificationsScreen')} style={styles.notificationButton}>
            <Icon name="notifications-outline" size={24} color="#fff" />
            {/* Notification Badge */}
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>2</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Enhanced Hero Section */}
        <View style={styles.heroSection}>
          <ImageBackground
            source={require('../assets/logo.jpeg')}
            style={styles.heroBg}
            imageStyle={{ opacity: 0.15, borderRadius: 0 }}
          >
            <View style={styles.heroContent}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../assets/logo.jpeg')}
                  style={styles.logo}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>Lost Something?</Text>
                <Text style={styles.heroSubtitle}>We help you find your lost items or report found ones</Text>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleReportLostItem}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#3d0c45' }]}>
                <Icon name="search-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.quickActionText}>Report Lost</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={handleReportFoundItem}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#6b2d72' }]}>
                <Icon name="add-circle-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.quickActionText}>Report Found</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('MatchesScreen')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#9d5ca3' }]}>
                <Icon name="git-compare-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.quickActionText}>View Matches</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={navigateToDashboard}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#d3afd7' }]}>
                <Icon name="stats-chart-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.quickActionText}>Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentActivityContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ActivityListScreen')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3d0c45" />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : recentActivity.length > 0 ? (
            <FlatList
              data={recentActivity}
              renderItem={renderActivityItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="document-text-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No recent activity</Text>
            </View>
          )}
        </View>

        {/* Tips Section */}
        <View style={styles.tipsContainer}>
          <Text style={styles.sectionTitle}>Tips & Advice</Text>
          <TouchableOpacity 
            style={styles.tipCard}
            onPress={() => navigation.navigate('TipsScreen')}
          >
            <Icon name="bulb-outline" size={24} color="#3d0c45" style={styles.tipIcon} />
            <Text style={styles.tipTitle}>How to increase chances of finding your item</Text>
            <Text style={styles.tipText}>
              Provide as many details as possible when reporting a lost item, including photos, location, and time.
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Icon name="home" size={24} color="#3d0c45" />
          <Text style={[styles.navText, { color: '#3d0c45' }]}>Home</Text>
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
          onPress={() => navigation.navigate('HelpScreen')}
        >
          <Icon name="help-circle" size={24} color="#666" />
          <Text style={styles.navText}>Help</Text>
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
              <TouchableOpacity 
                style={styles.notificationOption}
                onPress={() => navigation.navigate('NotificationsScreen')}
              >
                <Text style={styles.notificationOptionText}>View All</Text>
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
    backgroundColor: '#f8f9fa',
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dashboardButton: {
    padding: 8,
    marginRight: 8,
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
  scrollView: {
    flex: 1,
  },
  heroSection: {
    height: 220,
    marginBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  heroBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3d0c45',
  },
  heroContent: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    justifyContent: 'space-between',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  heroTextContainer: {
    flex: 1,
    marginLeft: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  quickActionsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  recentActivityContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#3d0c45',
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  activityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 12,
    color: '#666',
  },
  activityDate: {
    fontSize: 12,
    color: '#666',
  },
  activityStatus: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  activityStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tipsContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  tipCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
  },
  tipIcon: {
    marginBottom: 12,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  navItem: {
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  navText: {
    fontSize: 12,
    marginTop: 4,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  notificationContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  notificationHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationOptions: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  notificationOption: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  notificationOptionActive: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#3d0c45',
  },
  notificationOptionText: {
    color: '#666',
  },
  notificationOptionTextActive: {
    color: '#fff',
  },
  notificationList: {
    padding: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  unreadNotification: {
    backgroundColor: '#f0e6f2',
  },
  notificationIcon: {
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  emptyNotifications: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyNotificationsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    color: '#3d0c45',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  emptyContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
});

export default HomePage;
