import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    ActivityIndicator,
    RefreshControl,
    Alert,
    Dimensions,
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';

const { width, height } = Dimensions.get('window');
const BACKEND_URL = API_CONFIG.API_URL; // Using centralized config

const NotificationsScreen = ({ navigation }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userId, setUserId] = useState(null);
    
    useEffect(() => {
        // Get the user ID from AsyncStorage
        const getUserId = async () => {
            try {
                const userData = await AsyncStorage.getItem('userData');
                if (userData) {
                    const parsedUserData = JSON.parse(userData);
                    setUserId(parsedUserData._id);
                    fetchNotifications(parsedUserData._id);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error('Error getting user data:', error);
                setLoading(false);
            }
        };
        
        getUserId();
    }, []);
    
    const fetchNotifications = async (id) => {
        if (!id) return;
        
        try {
            const response = await axios.get(`${BACKEND_URL}/notifications/${id}`);
            if (response.data.status === 'success') {
                setNotifications(response.data.notifications);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            Alert.alert('Error', 'Failed to fetch notifications');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    
    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications(userId);
    };
    
    const markAsRead = async (notificationId) => {
        try {
            await axios.put(`${BACKEND_URL}/notifications/${notificationId}/read`);
            
            // Update the local state
            setNotifications(prevNotifications => 
                prevNotifications.map(notification => 
                    notification._id === notificationId 
                        ? { ...notification, read: true } 
                        : notification
                )
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };
    
    const handleNotificationPress = async (notification) => {
        // Mark the notification as read
        if (!notification.read) {
            await markAsRead(notification._id);
        }
        
        // Handle different notification types
        switch (notification.type) {
            case 'match_found':
                // Navigate to match details
                navigation.navigate('MatchDetailsScreen', {
                    lostItemId: notification.lostItemId,
                    foundItemId: notification.foundItemId
                });
                break;
                
            case 'message_received':
                // Navigate to chat
                navigation.navigate('ChatScreen', {
                    receiverId: notification.senderId,
                    receiverName: notification.senderName || 'User'
                });
                break;
                
            case 'system':
                // Just display the message
                Alert.alert('System Notification', notification.message);
                break;
                
            default:
                console.warn('Unknown notification type:', notification.type);
        }
    };
    
    const renderNotificationItem = ({ item }) => {
        // Format the date
        const date = new Date(item.createdAt);
        const formattedDate = date.toLocaleDateString();
        const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Set icon based on notification type
        let icon;
        switch (item.type) {
            case 'match_found':
                icon = 'checkmark-circle-outline';
                break;
            case 'message_received':
                icon = 'chatbubble-outline';
                break;
            case 'system':
                icon = 'information-circle-outline';
                break;
            default:
                icon = 'notifications-outline';
        }
        
        return (
            <TouchableOpacity 
                style={[
                    styles.notificationItem,
                    !item.read && styles.unreadNotification
                ]}
                onPress={() => handleNotificationPress(item)}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name={icon} size={24} color="#3d0c45" />
                </View>
                
                <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.notificationMessage}>{item.message}</Text>
                    <Text style={styles.notificationTime}>{formattedDate} at {formattedTime}</Text>
                </View>
                
                {!item.read && (
                    <View style={styles.unreadIndicator} />
                )}
            </TouchableOpacity>
        );
    };
    
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#3d0c45" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
            </View>
            
            {loading ? (
                <ActivityIndicator size="large" color="#3d0c45" style={styles.loader} />
            ) : notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>No notifications yet</Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderNotificationItem}
                    keyExtractor={(item) => item._id.toString()}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#3d0c45']}
                        />
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: width * 0.05,
        backgroundColor: '#FFFFFF',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    backButton: {
        marginRight: width * 0.03,
    },
    headerTitle: {
        fontSize: width * 0.06,
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    listContainer: {
        padding: width * 0.03,
    },
    notificationItem: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: width * 0.03,
        marginBottom: height * 0.015,
        padding: width * 0.04,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    unreadNotification: {
        backgroundColor: '#f0e6f5', // Light purple for unread notifications
    },
    iconContainer: {
        width: width * 0.12,
        height: width * 0.12,
        borderRadius: width * 0.06,
        backgroundColor: '#f0e6f5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: width * 0.03,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: width * 0.04,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginBottom: height * 0.005,
    },
    notificationMessage: {
        fontSize: width * 0.035,
        color: '#333',
        marginBottom: height * 0.01,
    },
    notificationTime: {
        fontSize: width * 0.03,
        color: '#999',
    },
    unreadIndicator: {
        width: width * 0.025,
        height: width * 0.025,
        borderRadius: width * 0.0125,
        backgroundColor: '#3d0c45',
        marginLeft: width * 0.02,
        alignSelf: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: width * 0.045,
        color: '#999',
        marginTop: height * 0.02,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default NotificationsScreen; 