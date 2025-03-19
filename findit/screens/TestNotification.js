import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

export default function TestNotification({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState(null);
    const [lastNotification, setLastNotification] = useState(null);
    const [notificationCount, setNotificationCount] = useState(0);

    useEffect(() => {
        getUserId();
    }, []);

    const getUserId = async () => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            if (userData) {
                const { _id } = JSON.parse(userData);
                setUserId(_id);
            }
        } catch (error) {
            console.error('Error getting user ID:', error);
            Alert.alert('Error', 'Could not get user ID');
        }
    };

    const createTestNotification = async () => {
        if (!userId) {
            Alert.alert('Error', 'User ID not found');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/test/notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to create notification');
            }

            setLastNotification(data.notification);
            Alert.alert('Success', 'Test notification created successfully');
        } catch (error) {
            console.error('Error creating test notification:', error);
            Alert.alert('Error', error.message || 'Failed to create notification');
        } finally {
            setLoading(false);
        }
    };

    const checkNotifications = async () => {
        if (!userId) {
            Alert.alert('Error', 'User ID not found');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/notifications/${userId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch notifications');
            }

            const notificationsList = data.notifications || [];
            setNotificationCount(notificationsList.length);
            
            // Update last notification if there are any
            if (notificationsList.length > 0) {
                setLastNotification(notificationsList[0]);
            }
            
            Alert.alert('Success', `Found ${notificationsList.length} notifications`);
        } catch (error) {
            console.error('Error checking notifications:', error);
            Alert.alert('Error', error.message || 'Failed to check notifications');
        } finally {
            setLoading(false);
        }
    };

    const markAllAsRead = async () => {
        if (!userId) {
            Alert.alert('Error', 'User ID not found');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/notifications/${userId}/read-all`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to mark notifications as read');
            }

            Alert.alert('Success', `Marked ${data.modifiedCount || 'all'} notifications as read`);
            
            // Refresh notifications count
            checkNotifications();
        } catch (error) {
            console.error('Error marking notifications as read:', error);
            Alert.alert('Error', error.message || 'Failed to mark notifications as read');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Notification Test Panel</Text>
                
                <View style={styles.infoContainer}>
                    <Text style={styles.infoText}>User ID: {userId || 'Not found'}</Text>
                    <Text style={styles.infoText}>Notification Count: {notificationCount}</Text>
                </View>

                {lastNotification && (
                    <View style={styles.notificationContainer}>
                        <Text style={styles.subtitle}>Last Created Notification:</Text>
                        <Text>Title: {lastNotification.title}</Text>
                        <Text>Message: {lastNotification.message}</Text>
                        <Text>Type: {lastNotification.type}</Text>
                        <Text>Read: {lastNotification.read ? 'Yes' : 'No'}</Text>
                    </View>
                )}

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={createTestNotification}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>Create Test Notification</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={checkNotifications}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>Check Notifications</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={markAllAsRead}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>Mark All as Read</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => navigation.navigate('NotificationsScreen')}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>Go to Notifications Screen</Text>
                    </TouchableOpacity>
                </View>

                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#3d0c45" />
                        <Text style={styles.loadingText}>Processing...</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginBottom: 20,
        textAlign: 'center',
    },
    infoContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 20,
    },
    infoText: {
        fontSize: 16,
        marginBottom: 8,
    },
    notificationContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 20,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#3d0c45',
    },
    buttonContainer: {
        gap: 12,
    },
    button: {
        backgroundColor: '#3d0c45',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    loadingContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        color: '#3d0c45',
        fontSize: 16,
    },
}); 