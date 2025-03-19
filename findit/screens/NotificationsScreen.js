import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    AppState,
    Platform
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, POLLING_INTERVAL } from '../config';
import { formatDistanceToNow } from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function NotificationsScreen({ navigation }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [lastPolled, setLastPolled] = useState(Date.now());
    const isFocused = useIsFocused();

    // Get userId from storage
    const getUserId = async () => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            if (userData) {
                const { _id } = JSON.parse(userData);
                return _id;
            }
            return null;
        } catch (error) {
            console.error('Error getting userId:', error);
            return null;
        }
    };

    // Fetch notifications with pagination
    const fetchNotifications = async (pageNum = 1, shouldRefresh = false) => {
        try {
            const userId = await getUserId();
            console.log('Fetching notifications for userId:', userId);
            if (!userId) {
                console.log('No userId found, returning');
                return;
            }

            const url = `${API_URL}/api/notifications/${userId}?page=${pageNum}&limit=20`;
            console.log('Fetching notifications from:', url);
            
            const response = await fetch(url);
            const data = await response.json();
            console.log('Notifications response:', data);

            if (!response.ok) throw new Error(data.error || 'Failed to fetch notifications');

            const notificationsList = data.notifications || [];
            console.log('Received notifications:', notificationsList.length);
            
            setNotifications(prev => 
                shouldRefresh ? notificationsList : [...prev, ...notificationsList]
            );
            setHasMore(data.hasMore);
            setPage(pageNum);
            setLoading(false);
            setRefreshing(false);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Poll for new notifications
    const pollNotifications = async () => {
        try {
            const userId = await getUserId();
            console.log('Polling notifications for userId:', userId);
            if (!userId) {
                console.log('No userId found for polling, returning');
                return;
            }

            const url = `${API_URL}/api/notifications/poll/${userId}?lastPolled=${lastPolled}`;
            console.log('Polling notifications from:', url);
            
            const response = await fetch(url);
            const data = await response.json();
            console.log('Polling response:', data);

            if (!response.ok) throw new Error(data.error || 'Failed to fetch notifications');

            const newNotifications = data.notifications || [];
            console.log('Received new notifications:', newNotifications.length);
            
            if (newNotifications.length > 0) {
                setNotifications(prev => {
                    const allNotifications = [...newNotifications, ...prev];
                    // Remove duplicates based on _id
                    const uniqueNotifications = Array.from(
                        new Map(allNotifications.map(item => [item._id, item])).values()
                    );
                    console.log('Updated notifications count:', uniqueNotifications.length);
                    return uniqueNotifications;
                });
            }

            setLastPolled(data.timestamp || Date.now());
        } catch (error) {
            console.error('Error polling notifications:', error);
        }
    };

    // Mark notification as read
    const markAsRead = async (notificationId) => {
        try {
            const response = await fetch(
                `${API_URL}/api/notifications/${notificationId}/read`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to mark notification as read');

            setNotifications(prev =>
                prev.map(notification =>
                    notification._id === notificationId
                        ? { ...notification, read: true }
                        : notification
                )
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Mark all notifications as read
    const markAllAsRead = async () => {
        try {
            const userId = await getUserId();
            if (!userId) return;

            const response = await fetch(
                `${API_URL}/api/notifications/${userId}/read-all`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to mark all notifications as read');

            setNotifications(prev =>
                prev.map(notification => ({ ...notification, read: true }))
            );
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    // Setup polling
    useEffect(() => {
        let pollTimer;

        if (isFocused) {
            pollTimer = setInterval(pollNotifications, POLLING_INTERVAL);
            pollNotifications(); // Initial poll
        }

        return () => {
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [isFocused]);

    // Initial fetch
    useEffect(() => {
        if (isFocused) {
            setLoading(true);
            fetchNotifications(1, true);
        }
    }, [isFocused]);

    // Handle refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNotifications(1, true);
    }, []);

    // Load more notifications
    const loadMore = () => {
        if (!loading && hasMore) {
            fetchNotifications(page + 1);
        }
    };

    // Render notification item
    const renderNotification = ({ item }) => {
        const getNotificationIcon = (type) => {
            switch (type) {
                case 'match_found':
                    return 'target';
                case 'message_received':
                    return 'message-text';
                default:
                    return 'bell';
            }
        };

        return (
            <TouchableOpacity
                style={[
                    styles.notificationItem,
                    !item.read && styles.unreadNotification
                ]}
                onPress={() => {
                    markAsRead(item._id);
                    // Navigate based on notification type
                    if (item.type === 'message_received' && item.chatId) {
                        navigation.navigate('Chat', { chatId: item.chatId });
                    } else if (item.type === 'match_found' && item.matchId) {
                        navigation.navigate('MatchDetails', { matchId: item.matchId });
                    }
                }}
            >
                <View style={styles.notificationContent}>
                    <Icon
                        name={getNotificationIcon(item.type)}
                        size={24}
                        color="#3d0c45"
                        style={styles.icon}
                    />
                    <View style={styles.textContainer}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.message}>{item.message}</Text>
                        <Text style={styles.time}>
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
                <TouchableOpacity
                    style={styles.markAllButton}
                    onPress={markAllAsRead}
                >
                    <Text style={styles.markAllText}>Mark all as read</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={item => item._id}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#3d0c45']}
                    />
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListEmptyComponent={
                    !loading && (
                        <View style={styles.emptyContainer}>
                            <Icon name="bell-off" size={48} color="#666" />
                            <Text style={styles.emptyText}>No notifications yet</Text>
                        </View>
                    )
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef'
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#3d0c45'
    },
    markAllButton: {
        padding: 8
    },
    markAllText: {
        color: '#3d0c45',
        fontSize: 14
    },
    notificationItem: {
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef'
    },
    unreadNotification: {
        backgroundColor: '#f8f0ff'
    },
    notificationContent: {
        flexDirection: 'row',
        alignItems: 'flex-start'
    },
    icon: {
        marginRight: 12
    },
    textContainer: {
        flex: 1
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginBottom: 4
    },
    message: {
        fontSize: 14,
        color: '#495057',
        marginBottom: 8
    },
    time: {
        fontSize: 12,
        color: '#6c757d'
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        textAlign: 'center'
    }
}); 