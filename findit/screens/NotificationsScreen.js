import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    AppState,
    Platform,
    Image,
    ActivityIndicator,
    Alert,
    StatusBar
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';
import { formatDistanceToNow } from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import { useRef } from 'react';
import { Vibration } from 'react-native';

// Get the status bar height for proper padding
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

export default function NotificationsScreen({ navigation }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [userId, setUserId] = useState(null);
    const [pollingInterval, setPollingInterval] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loadingMatches, setLoadingMatches] = useState(true);
    const lastPolledRef = useRef(null);
    const [allLostItems, setAllLostItems] = useState([]);

    // Get userId from storage
    const getUserId = async () => {
        try {
            const userData = await AsyncStorage.getItem('userData');
            if (userData) {
                const data = JSON.parse(userData);
                setUserId(data.id);
                return data.id;
            }
            return null;
        } catch (error) {
            console.error('Error getting user ID:', error);
            return null;
        }
    };

    // Initial load
    useEffect(() => {
        const loadData = async () => {
            const id = await getUserId();
            if (id) {
                fetchNotifications();
                fetchUserMatches(id);
                
                // Start polling for new notifications
                const interval = setInterval(() => {
                    pollNotifications();
                }, API_CONFIG.POLLING_INTERVAL || 5000);
                
                setPollingInterval(interval);
                
                // Count unread notifications
                updateUnreadCount();
            }
        };
        
        loadData();
        
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, []);

    // Update unread count based on current notifications
    const updateUnreadCount = () => {
        const count = notifications.filter(item => !item.read).length;
        setUnreadCount(count);
    };
    
    // Update unread count whenever notifications change
    useEffect(() => {
        updateUnreadCount();
    }, [notifications]);

    // Fetch user's matches
    const fetchUserMatches = async (userId) => {
        try {
            setLoadingMatches(true);
            console.log('Fetching matches for user:', userId);
            
            const response = await fetch(`${API_CONFIG.API_URL}/api/matches/user/${userId}`);
            console.log('Match response status:', response.status);
            
            if (!response.ok) {
                console.error('Failed to fetch user matches');
                setMatches([]);
                setLoadingMatches(false);
                return;
            }
            
            const data = await response.json();
            console.log('Total matches in database:', data.totalMatches || 0);
            console.log(`Found ${data.matches?.length || 0} matches for user ${userId}`);
            
            // Transform matches to display format
            const matchItems = data.matches?.map(match => ({
                _id: match._id,
                itemName: match.lostItem?.itemName || match.foundItem?.itemName || 'Matched Item',
                location: match.lostItem?.location || match.foundItem?.location || 'Unknown',
                date: match.lostItem?.date || match.foundItem?.date || match.createdAt,
                time: match.lostItem?.time || match.foundItem?.time,
                category: match.lostItem?.category || match.foundItem?.category || 'Uncategorized',
                photo: match.lostItem?.photo || match.foundItem?.photo,
                similarityScore: match.similarityScore,
                matchId: match._id,
                lostItemId: match.lostItem?._id,
                foundItemId: match.foundItem?._id,
                isMatch: true
            })) || [];
            
            setMatches(matchItems);
        } catch (error) {
            console.error('Error fetching user matches:', error.message);
            setMatches([]);
        } finally {
            setLoadingMatches(false);
        }
    };

    // Fetch notifications with pagination
    const fetchNotifications = async (pageNum = 1, shouldRefresh = false) => {
        try {
            const id = await getUserId();
            console.log('Fetching notifications for userId:', id);
            if (!id) {
                console.log('No userId found, returning');
                setLoading(false);
                setRefreshing(false);
                return;
            }

            // Fetch regular notifications from API
            setLoading(true);
            setError(null);
            
            const url = `${API_CONFIG.API_URL}/api/notifications/${id}?page=${pageNum}&limit=20`;
            console.log('Fetching notifications from:', url);
            
            const response = await fetch(url);
            console.log('Notifications response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Error response from server:', errorData);
                setLoading(false);
                setRefreshing(false);
                setError('Failed to fetch notifications');
                return;
            }
            
            const data = await response.json();
            
            if (!data.success) {
                console.error('Failed to fetch notifications:', data);
                throw new Error(data.error || 'Failed to fetch notifications');
            }

            const notificationsList = data.notifications || [];
            console.log(`Received ${notificationsList.length} notifications for user ${id}`);
            
            // Fetch match-based notifications
            console.log('Fetching match data for notifications');
            const matchesUrl = `${API_CONFIG.API_URL}/api/view-matches?userId=${id}`;
            const matchesResponse = await fetch(matchesUrl);
            
            let matchNotifications = [];
            
            if (matchesResponse.ok) {
                const matchesData = await matchesResponse.json();
                const allMatches = matchesData.matches || [];
                console.log(`Received ${allMatches.length} matches`);
                
                // Generate notifications from ALL matches, regardless of user involvement
                // This ensures matches.length == matchNotifications.length
                matchNotifications = allMatches.map(match => {
                    // Check if this match involves the current user
                    const isLostItemUser = match.lostUserId && match.lostUserId.toString() === id.toString();
                    const isFoundItemUser = match.foundUserId && match.foundUserId.toString() === id.toString();
                    
                    let message, title;
                    
                    if (isLostItemUser) {
                        // User reported the lost item
                        const itemName = match.lostItemId?.itemName || 'unknown item';
                        title = "Match Found!";
                        message = `Someone may have found your lost ${itemName}!`;
                    } else if (isFoundItemUser) {
                        // User reported the found item
                        const itemName = match.foundItemId?.itemName || 'unknown item';
                        const lostItemName = match.lostItemId?.itemName || 'item';
                        title = "Match Found!";
                        message = `Your found item matches with someone's lost ${lostItemName}!`;
                    } else {
                        // This is a match that doesn't involve the current user
                        // But we still create a notification to ensure matches.length == matchNotifications.length
                        title = "System Match";
                        message = `Match between ${match.lostItemId?.itemName || 'lost item'} and ${match.foundItemId?.itemName || 'found item'}`;
                    }
                    
                    // Generate a notification-like object for each match
                    return {
                        _id: `match_${match._id}`,
                        type: 'match_found',
                        title: title,
                        message: message,
                        createdAt: match.createdAt,
                        read: false, // Assume unread by default
                        matchId: match._id,
                        lostItemId: match.lostItemId?._id,
                        foundItemId: match.foundItemId?._id,
                        lostItemName: match.lostItemId?.itemName,
                        foundItemName: match.foundItemId?.itemName,
                        lostItemDescription: match.lostItemId?.description,
                        foundItemDescription: match.foundItemId?.description,
                        lostItemLocation: match.lostItemId?.location,
                        foundItemLocation: match.foundItemId?.location,
                        lostItemCategory: match.lostItemId?.category,
                        foundItemCategory: match.foundItemId?.category,
                        lostItemDate: match.lostItemId?.date,
                        foundItemDate: match.foundItemId?.date,
                        similarityScore: match.similarityScore,
                        isLostItemUser: isLostItemUser,
                        isFoundItemUser: isFoundItemUser,
                        category: isLostItemUser ? match.lostItemId?.category : match.foundItemId?.category,
                        location: isLostItemUser ? match.lostItemId?.location : match.foundItemId?.location,
                        matchDate: match.createdAt
                    };
                });
                
                // Store the match count to display in the UI
                setMatches(matchesData.matches || []);
            } else {
                console.error('Failed to fetch matches for notifications:', await matchesResponse.text());
            }
            
            // Combine regular notifications with match-based notifications
            const combinedNotifications = [...matchNotifications, ...notificationsList];
            
            // Sort by creation date (newest first)
            combinedNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Process notifications to ensure all required data is available
            const processedNotifications = combinedNotifications.map(notification => {
                    // Make a deep copy to avoid reference issues
                    const processedNotification = {...notification};
                    
                if (notification.type === 'match_found') {
                    // Ensure lost item description exists
                    if (!processedNotification.lostItemDescription) {
                        processedNotification.lostItemDescription = "Description not available";
                    }
                    
                    // Ensure found item description exists
                    if (!processedNotification.foundItemDescription) {
                        processedNotification.foundItemDescription = "Description not available";
                    }
                    
                    // Ensure other required fields exist
                    if (!processedNotification.lostItemName) {
                        processedNotification.lostItemName = "Lost Item";
                    }
                    
                    if (!processedNotification.foundItemName) {
                        processedNotification.foundItemName = "Found Item";
                    }
                    
                    // Ensure the match ID is correctly formatted
                    if (processedNotification.matchId && typeof processedNotification.matchId === 'object') {
                        processedNotification.matchId = processedNotification.matchId.toString();
                    }
                    
                    // Log the processed notification details
                    console.log('Processed match notification:', JSON.stringify({
                        id: processedNotification._id,
                        type: processedNotification.type,
                        matchId: processedNotification.matchId,
                        lostItemName: processedNotification.lostItemName,
                        foundItemName: processedNotification.foundItemName,
                        similarityScore: processedNotification.similarityScore || 'not available'
                    }, null, 2));
                } else if (notification.type === 'lost_item_report') {
                    // Ensure item name is available
                    if (!processedNotification.itemName) {
                        processedNotification.itemName = "Lost Item";
                    }
                    }
                    
                    return processedNotification;
            });
            
            // Update the notifications state based on pagination
            if (shouldRefresh) {
                setNotifications(processedNotifications);
            } else {
                setNotifications(prev => [...prev, ...processedNotifications]);
            }
            
            // Update pagination state
            setHasMore(data.hasMore === true);
            setPage(pageNum);
            
            // Update loading states
            setLoading(false);
            setRefreshing(false);
            
            // Update unread count
            updateUnreadCount();
        } catch (error) {
            console.error('Error fetching notifications:', error);
            setLoading(false);
            setRefreshing(false);
            setError('Failed to load notifications');
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

            const lastPolled = lastPolledRef.current || Date.now();
            console.log(`Polling for new notifications since: ${new Date(lastPolled).toISOString()}`);
            
            // Poll regular notifications
            const response = await axios.get(`${API_CONFIG.API_URL}/api/notifications/poll/${userId}`, {
                params: { lastPolled }
            });
            
            // Poll for new matches
            const matchesResponse = await axios.get(`${API_CONFIG.API_URL}/api/view-matches?userId=${userId}`);
            
            // Update last polled time
            lastPolledRef.current = Date.now();
            
            let newNotifications = [];
            
            // Process regular notifications if available
            if (response.data.notifications && Array.isArray(response.data.notifications)) {
                newNotifications = [...response.data.notifications];
            }
            
            // Process match notifications
            if (matchesResponse.data && matchesResponse.data.matches && Array.isArray(matchesResponse.data.matches)) {
                const matches = matchesResponse.data.matches;
                
                // Find matches created after the last poll time
                const recentMatches = matches.filter(match => 
                    new Date(match.createdAt) > new Date(lastPolled)
                );
                
                console.log(`Found ${recentMatches.length} new matches since last poll`);
                
                // Convert recent matches to notifications - only for user's own items
                const matchNotifications = recentMatches.map(match => {
                    // Check if this match involves the current user
                    const isLostItemUser = match.lostUserId && match.lostUserId.toString() === userId.toString();
                    const isFoundItemUser = match.foundUserId && match.foundUserId.toString() === userId.toString();
                    
                    // Skip if this user is not involved in the match
                    if (!isLostItemUser && !isFoundItemUser) {
                        console.log(`Match ${match._id} does not involve current user ${userId}, skipping notification`);
                        return null;
                    }
                    
                    let message, itemName, title;
                    
                    if (isLostItemUser) {
                        // User reported the lost item
                        itemName = match.lostItemId?.itemName || 'unknown item';
                        title = "Match Found!";
                        message = `Someone may have found your lost ${itemName}!`;
                    } else if (isFoundItemUser) {
                        // User reported the found item
                        itemName = match.foundItemId?.itemName || 'unknown item';
                        const lostItemName = match.lostItemId?.itemName || 'item';
                        title = "Match Found!";
                        message = `Your found item matches with someone's lost ${lostItemName}!`;
                    }
                    
                    // Create notification object
                    return {
                        _id: `match_${match._id}`,
                        type: 'match_found',
                        title: title,
                        message: message,
                        createdAt: match.createdAt,
                        read: false,
                        matchId: match._id,
                        lostItemId: match.lostItemId?._id,
                        foundItemId: match.foundItemId?._id,
                        lostItemName: match.lostItemId?.itemName,
                        foundItemName: match.foundItemId?.itemName,
                        lostItemDescription: match.lostItemId?.description,
                        foundItemDescription: match.foundItemId?.description,
                        lostItemLocation: match.lostItemId?.location,
                        foundItemLocation: match.foundItemId?.location,
                        lostItemCategory: match.lostItemId?.category,
                        foundItemCategory: match.foundItemId?.category,
                        lostItemDate: match.lostItemId?.date,
                        foundItemDate: match.foundItemId?.date,
                        similarityScore: match.similarityScore,
                        isLostItemUser: isLostItemUser,
                        isFoundItemUser: isFoundItemUser,
                        category: isLostItemUser ? match.lostItemId?.category : match.foundItemId?.category,
                        location: isLostItemUser ? match.lostItemId?.location : match.foundItemId?.location,
                        matchDate: match.createdAt
                    };
                }).filter(notification => notification !== null);
                
                // Add match notifications to the list of new notifications
                newNotifications = [...matchNotifications, ...newNotifications];
            }
            
            if (newNotifications.length === 0) {
                console.log('No new notifications found');
                return;
            }
            
            console.log(`Polled ${newNotifications.length} new notifications`);
            
            // Count notification types for logging
            const notificationTypes = {};
            newNotifications.forEach(n => {
                notificationTypes[n.type] = (notificationTypes[n.type] || 0) + 1;
            });
            
            console.log('Notification types in polling:', notificationTypes);
            
            // Process any match notifications to ensure descriptions are available
            const processedNewNotifications = newNotifications.map(notification => {
                if (notification.type === 'match_found') {
                    console.log(`Processing new match notification ${notification._id}`);
                    
                    // Make a deep copy to avoid reference issues
                    const processedNotification = {...notification};
                    
                    // Ensure lost item description exists
                    if (!processedNotification.lostItemDescription) {
                        processedNotification.lostItemDescription = "Description not available";
                    }
                    
                    // Ensure found item description exists
                    if (!processedNotification.foundItemDescription) {
                        processedNotification.foundItemDescription = "Description not available";
                    }
                    
                    // Ensure other required fields exist
                    if (!processedNotification.lostItemName) {
                        processedNotification.lostItemName = "Lost Item";
                    }
                    
                    if (!processedNotification.foundItemName) {
                        processedNotification.foundItemName = "Found Item";
                    }
                    
                    // Ensure the match ID is properly formatted
                    if (processedNotification.matchId && typeof processedNotification.matchId === 'object') {
                        processedNotification.matchId = processedNotification.matchId.toString();
                    }
                    
                    return processedNotification;
                }
                return notification;
            });
            
            // Check for unread match notifications
            const unreadMatchNotifications = processedNewNotifications.filter(
                n => n.type === 'match_found' && !n.read
            );
            
            if (unreadMatchNotifications.length > 0) {
                console.log(`Found ${unreadMatchNotifications.length} unread match notifications`);
                
                // Vibrate device for matches (if supported by the device)
                if (Platform.OS !== 'web') {
                    Vibration.vibrate([0, 500, 200, 500]);
                }
                
                // Show an alert for the most recent match
                const mostRecentMatch = unreadMatchNotifications[0];
                
                if (Platform.OS !== 'web' && AppState.currentState === 'active') {
                    Alert.alert(
                        'New Match Found!',
                        mostRecentMatch.message,
                        [
                            { 
                                text: 'View', 
                                onPress: () => {
                                    const matchId = mostRecentMatch.matchId;
                                    if (matchId) {
                                        markAsRead(mostRecentMatch._id);
                                        navigation.navigate('MatchDetailsScreen', { matchId });
                                    } else {
                                        console.log('No matchId available, cannot navigate');
                                    }
                                }
                            },
                            { text: 'Dismiss', style: 'cancel' }
                        ]
                    );
                }
            }
            
            // Add new notifications to the list
            if (processedNewNotifications.length > 0) {
                setNotifications(prevNotifications => [
                    ...processedNewNotifications,
                    ...prevNotifications
                ]);
            }
        } catch (error) {
            console.error('Error polling notifications:', error);
        }
    };

    // Mark notification as read
    const markAsRead = async (notificationId) => {
        try {
            const response = await fetch(
                `${API_CONFIG.API_URL}/api/notifications/${notificationId}/read`,
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
                `${API_CONFIG.API_URL}/api/notifications/${userId}/read-all`,
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

    // Fetch all lost items for display in notifications
    useEffect(() => {
        const fetchAllLostItems = async () => {
            try {
                const response = await fetch(`${API_CONFIG.API_URL}/all-lost-items`);
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Found ${data.items?.length || 0} lost items`);
                    // Use this data to enrich match notification details
                    setAllLostItems(data.items || []);
                }
            } catch (error) {
                console.error('Error fetching all lost items:', error);
            }
        };
        
        fetchAllLostItems();
    }, []);

    // Format additional details for item notifications with enhanced lost item details
        const renderAdditionalDetails = (notification) => {
        if (notification.type === 'lost_item_report') {
                return (
                    <View style={styles.notificationDetails}>
                        {notification.location && (
                            <View style={styles.detailRow}>
                                <Icon name="map-marker" size={16} color="#555" />
                                <Text style={styles.detailText}>{notification.location}</Text>
                            </View>
                        )}
                        {notification.date && (
                            <View style={styles.detailRow}>
                                <Icon name="calendar" size={16} color="#555" />
                                <Text style={styles.detailText}>
                                    {new Date(notification.date).toLocaleDateString()}
                                </Text>
                            </View>
                        )}
                        {notification.time && (
                            <View style={styles.detailRow}>
                                <Icon name="clock-outline" size={16} color="#555" />
                                <Text style={styles.detailText}>
                                    {new Date(notification.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        )}
                        {notification.category && (
                            <View style={styles.detailRow}>
                                <Icon name="tag" size={16} color="#555" />
                                <Text style={styles.detailText}>{notification.category}</Text>
                            </View>
                        )}
                        {notification.itemName && (
                            <View style={styles.detailRow}>
                                <Icon name="information-outline" size={16} color="#555" />
                                <Text style={styles.detailText}>{notification.itemName}</Text>
                            </View>
                        )}
                        <TouchableOpacity 
                            style={styles.viewButtonContainer}
                            onPress={() => {
                                markAsRead(notification._id);
                                if (notification.lostItemId) {
                                    navigation.navigate('ItemDetails', { 
                                        itemId: notification.lostItemId,
                                        itemType: 'lost'
                                    });
                                }
                            }}
                        >
                            <Text style={styles.viewButtonText}>View Item Details</Text>
                        </TouchableOpacity>
                    </View>
                );
            } else if (notification.type === 'match_found') {
                // Ensure matchId is extracted from the notification
                let matchId = notification.matchId;
                if (!matchId && notification._doc && notification._doc.matchId) {
                    matchId = notification._doc.matchId;
                }
                
                // Format the match date if available
                const matchDate = notification.matchDate 
                    ? new Date(notification.matchDate).toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
                
                // Determine if the user is the one who lost the item or found the item
            const isLostItemUser = notification.isLostItemUser || !!notification.lostItemId;
            const isFoundItemUser = notification.isFoundItemUser || !!notification.foundItemId;
            
            // Calculate similarity percentage for display
            const similarityPercentage = Math.round((notification.similarityScore || 0) * 100);
            
            // Determine color based on similarity score
            const getScoreColor = (score) => {
                if (score >= 0.7) return '#28a745';  // Green for high match
                if (score >= 0.4) return '#ffc107';  // Yellow for moderate match
                return '#dc3545';  // Red for low match
            };
            
            const scoreColor = getScoreColor(notification.similarityScore || 0);
                
                return (
                    <View style={styles.matchNotificationDetails}>
                        <View style={styles.matchHeader}>
                            <Icon name="target" size={20} color="#ff6b6b" />
                            <Text style={styles.matchTitleText}>Match Found!</Text>
                        <View style={styles.matchBadge}>
                            <Icon name="percent" size={14} color="#fff" />
                            <Text style={styles.matchBadgeText}>{similarityPercentage}% Match</Text>
                        </View>
                        </View>
                        
                        <View style={styles.matchIntro}>
                            {isLostItemUser ? (
                                <Text style={styles.matchIntroText}>
                                    Someone found an item that matches your lost {notification.lostItemName || "item"}!
                                </Text>
                        ) : isFoundItemUser ? (
                            <Text style={styles.matchIntroText}>
                                Your found item matches with someone's lost {notification.lostItemName || "item"}!
                            </Text>
                            ) : (
                                <Text style={styles.matchIntroText}>
                                System detected a match between lost and found items.
                                </Text>
                            )}
                        </View>
                        
                    {/* Match Details */}
                        <View style={styles.matchInfoContainer}>
                        {/* Items Information */}
                        <View style={styles.matchItemsInfo}>
                            <View style={styles.matchItemColumn}>
                                <View style={styles.matchItemColumnHeader}>
                                    <Icon name="alert-circle-outline" size={16} color="#3d0c45" />
                                    <Text style={styles.matchItemColumnTitle}>Lost Item</Text>
                                </View>
                                
                                <Text style={styles.matchItemName}>
                                    {notification.lostItemName || "Lost Item"}
                                </Text>
                                
                                {notification.lostItemDescription && (
                                    <Text style={styles.matchItemDescription} numberOfLines={2}>
                                        {notification.lostItemDescription}
                                    </Text>
                                )}
                                
                                {notification.lostItemLocation && (
                            <View style={styles.detailRow}>
                                        <Icon name="map-marker" size={14} color="#555" />
                                <Text style={styles.detailText}>
                                            {notification.lostItemLocation}
                                    </Text>
                                    </View>
                                )}
                                
                                {notification.lostItemCategory && (
                                    <View style={styles.detailRow}>
                                        <Icon name="tag" size={14} color="#555" />
                                        <Text style={styles.detailText}>
                                            {notification.lostItemCategory}
                                </Text>
                            </View>
                                )}
                            
                                {notification.lostItemDate && (
                            <View style={styles.detailRow}>
                                        <Icon name="calendar" size={14} color="#555" />
                                <Text style={styles.detailText}>
                                            {new Date(notification.lostItemDate).toLocaleDateString()}
                                    </Text>
                                    </View>
                                )}
                            </View>
                            
                            <View style={styles.matchItemDivider} />
                            
                            <View style={styles.matchItemColumn}>
                                <View style={styles.matchItemColumnHeader}>
                                    <Icon name="magnify" size={16} color="#3d0c45" />
                                    <Text style={styles.matchItemColumnTitle}>Found Item</Text>
                                </View>
                                
                                <Text style={styles.matchItemName}>
                                    {notification.foundItemName || "Found Item"}
                                </Text>
                                
                                {notification.foundItemDescription && (
                                    <Text style={styles.matchItemDescription} numberOfLines={2}>
                                        {notification.foundItemDescription}
                                    </Text>
                                )}
                                
                                {notification.foundItemLocation && (
                                    <View style={styles.detailRow}>
                                        <Icon name="map-marker" size={14} color="#555" />
                                        <Text style={styles.detailText}>
                                            {notification.foundItemLocation}
                                </Text>
                            </View>
                                )}
                                
                                {notification.foundItemCategory && (
                                    <View style={styles.detailRow}>
                                        <Icon name="tag" size={14} color="#555" />
                                        <Text style={styles.detailText}>
                                            {notification.foundItemCategory}
                                        </Text>
                                    </View>
                                )}
                                
                                {notification.foundItemDate && (
                                    <View style={styles.detailRow}>
                                        <Icon name="calendar" size={14} color="#555" />
                                        <Text style={styles.detailText}>
                                            {new Date(notification.foundItemDate).toLocaleDateString()}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        
                        {/* Match Date */}
                            <View style={styles.detailRow}>
                                <Icon name="clock-outline" size={16} color="#555" />
                                <Text style={styles.detailText}>
                                    <Text style={{fontWeight: 'bold'}}>Match time: </Text>
                                    {matchDate}
                                </Text>
                            </View>
                        
                        {/* Match Score */}
                        <View style={styles.matchScoreContainer}>
                            <Text style={styles.matchScoreLabel}>Match Similarity</Text>
                            <View style={styles.scoreBar}>
                                <View 
                                    style={[
                                        styles.scoreBarFill, 
                                        { width: `${similarityPercentage}%`, backgroundColor: scoreColor }
                                    ]}
                                />
                            </View>
                            <Text style={[styles.scoreText, { color: scoreColor }]}>
                                {similarityPercentage}% Match
                            </Text>
                        </View>
                        </View>
                        
                    {/* View Match Button - More prominent */}
                        <TouchableOpacity 
                        style={styles.viewMatchButton}
                        onPress={() => handleMatchNavigation(notification)}
                    >
                        <Icon name="target" size={16} color="#fff" />
                        <Text style={styles.viewMatchButtonText}>View Match Details</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return null;
    };

    // Render notification item
    const renderNotification = ({ item }) => {
        const getNotificationIcon = (type) => {
            switch (type) {
                case 'match_found':
                    return 'target';
                case 'message_received':
                    return 'message-text';
                case 'lost_item_report':
                    return 'alert-outline';
                default:
                    return 'bell';
            }
        };

        const handleNotificationPress = (notification) => {
            console.log('Notification pressed:', notification.type);
                                markAsRead(notification._id);
            
            // Navigate based on notification type
            if (notification.type === 'message_received' && notification.chatId) {
                console.log('Navigating to Chat with chatId:', notification.chatId);
                navigation.navigate('Chat', { chatId: notification.chatId });
            } else if (notification.type === 'match_found') {
                // For match notifications, navigation is handled in the View Match button
                console.log('Match notification pressed, expanding details');
            } else if (notification.type === 'lost_item_report' && notification.lostItemId) {
                // Navigate to lost item details
                console.log('Navigating to ItemDetails with lostItemId:', notification.lostItemId);
                navigation.navigate('ItemDetails', { 
                    itemId: notification.lostItemId,
                    itemType: 'lost'
                });
            } else {
                console.log('No navigation performed - missing required data');
                console.log('Notification data:', JSON.stringify(notification, null, 2));
            }
        };

        // Handle match notification navigation with appropriate error handling
        const handleMatchNavigation = (notification) => {
            // Handle the matchId with better error checking
            let matchId = null;
            
            // Check all possible locations for matchId
            if (typeof notification.matchId === 'string' && notification.matchId.length > 0) {
                matchId = notification.matchId;
            } else if (notification.matchId && notification.matchId._id) {
                matchId = notification.matchId._id;
            } else if (notification._doc && notification._doc.matchId) {
                matchId = notification._doc.matchId;
            }
            
            console.log('Extracted matchId:', matchId);
            
                                if (matchId) {
                                    console.log('Navigating to MatchDetailsScreen with matchId:', matchId);
                markAsRead(notification._id);
                // Ensure we navigate to MatchDetailsScreen, not MatchDetails
                                    navigation.navigate('MatchDetailsScreen', { matchId: matchId });
                                } else {
                console.log('No matchId available in match notification, trying to handle navigation differently');
                
                // If we have both lost and found item IDs, we can try to build a match details view
                if (notification.lostItemId && notification.foundItemId) {
                    Alert.alert(
                        "Match Details", 
                        "Would you like to view details for the lost item or the found item?",
                        [
                            {
                                text: "View Lost Item", 
                                onPress: () => {
                                    console.log("Navigating to lost item details");
                                    markAsRead(notification._id);
                                    navigation.navigate('ItemDetails', { 
                                        itemId: notification.lostItemId,
                                        itemType: 'lost'
                                    });
                                }
                            },
                            {
                                text: "View Found Item", 
                                onPress: () => {
                                    console.log("Navigating to found item details");
                                    markAsRead(notification._id);
                                    navigation.navigate('ItemDetails', { 
                                        itemId: notification.foundItemId,
                                        itemType: 'found'
                                    });
                                }
                            },
                            {
                                text: "Cancel",
                                style: "cancel"
                            }
                        ]
                    );
                } else {
                    // If we don't have item IDs either, show an error
                                    Alert.alert(
                                        "Navigation Error", 
                        "Cannot view match details - match ID is missing.",
                        [{ text: "OK", onPress: () => console.log("OK Pressed") }]
                    );
                }
            }
        };

        return (
            <TouchableOpacity
                style={[
                    styles.notificationItem,
                    !item.read && styles.unreadNotification,
                    item.type === 'match_found' && styles.matchNotificationItem
                ]}
                onPress={() => handleNotificationPress(item)}
            >
                <View style={styles.notificationContent}>
                    <Icon
                        name={getNotificationIcon(item.type)}
                        size={24}
                        color={item.type === 'match_found' ? '#ff6b6b' : '#3d0c45'}
                        style={styles.icon}
                    />
                    <View style={styles.textContainer}>
                        <Text style={[
                            styles.title,
                            item.type === 'match_found' && styles.matchTitle
                        ]}>
                            {item.title || (item.type === 'match_found' ? 'Match Found!' : 'Notification')}
                        </Text>
                        <Text style={styles.message}>{item.message}</Text>
                        
                        {/* Display match badge for match notifications */}
                        {item.type === 'match_found' && !item.expanded && (
                            <View style={styles.matchBadgeInline}>
                                <Icon name="target" size={14} color="#fff" />
                                <Text style={styles.matchBadgeText}>
                                    {Math.round((item.similarityScore || 0) * 100)}% Match
                                </Text>
                            </View>
                        )}
                        
                        {renderAdditionalDetails(item)}
                        <Text style={styles.time}>
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Render a match item
    const renderMatchItem = ({ item }) => {
        const formattedDate = item.date ? new Date(item.date).toLocaleDateString() : 'Unknown';
        const formattedTime = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
        
        // Safely handle photo data
        const hasPhoto = item.photo && typeof item.photo === 'string' && item.photo.length > 0;
        
        // Format similarity score
        const similarityPercentage = Math.round((item.similarityScore || 0) * 100);
        
        // Determine color based on similarity score
        const getScoreColor = (score) => {
            if (score >= 0.7) return '#28a745';  // Green for high match
            if (score >= 0.4) return '#ffc107';  // Yellow for moderate match
            return '#dc3545';  // Red for low match
        };
        
        const scoreColor = getScoreColor(item.similarityScore || 0);
        
        return (
            <TouchableOpacity
                style={styles.matchItemContainer}
                onPress={() => navigation.navigate('MatchDetailsScreen', { matchId: item.matchId })}
            >
                <View style={styles.matchItemHeader}>
                    <Icon name="target" size={24} color="#ff6b6b" />
                    <Text style={styles.matchItemTitle}>{item.itemName || 'Matched Item'}</Text>
                    
                    <View style={styles.matchItemBadge}>
                        <Icon name="percent" size={14} color="#fff" />
                        <Text style={styles.matchBadgeText}>{similarityPercentage}% Match</Text>
                    </View>
                </View>
                
                <View style={styles.matchItemDetails}>
                    {hasPhoto ? (
                        <Image 
                            source={{ uri: `data:image/jpeg;base64,${item.photo}` }}
                            style={styles.matchItemImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.matchItemImage, styles.noImagePlaceholder]}>
                            <Icon name="image-off" size={30} color="#ccc" />
                        </View>
                    )}
                    
                    <View style={styles.matchItemInfo}>
                        <View style={styles.detailRow}>
                            <Icon name="map-marker" size={16} color="#555" />
                            <Text style={styles.detailText}>{item.location || 'Unknown location'}</Text>
                        </View>
                        
                        <View style={styles.detailRow}>
                            <Icon name="calendar" size={16} color="#555" />
                            <Text style={styles.detailText}>{formattedDate}</Text>
                        </View>
                        
                        <View style={styles.detailRow}>
                            <Icon name="clock-outline" size={16} color="#555" />
                            <Text style={styles.detailText}>{formattedTime}</Text>
                        </View>
                        
                        <View style={styles.detailRow}>
                            <Icon name="tag" size={16} color="#555" />
                            <Text style={styles.detailText}>{item.category || 'Uncategorized'}</Text>
                        </View>
                    </View>
                </View>
                
                <View style={styles.matchScoreContainer}>
                    <Text style={styles.matchScoreLabel}>Match Similarity</Text>
                    <View style={styles.scoreBar}>
                        <View 
                            style={[
                                styles.scoreBarFill, 
                                { width: `${similarityPercentage}%`, backgroundColor: scoreColor }
                            ]}
                        />
                    </View>
                    <Text style={[styles.scoreText, { color: scoreColor }]}>
                        {similarityPercentage}% Match
                    </Text>
                </View>
                
                <TouchableOpacity 
                    style={styles.matchButtonContainer}
                    onPress={() => navigation.navigate('MatchDetailsScreen', { matchId: item.matchId })}
                >
                    <Text style={styles.viewButtonText}>View Match Details</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    // Render a lost item
    const renderLostItem = ({ item }) => {
        const formattedDate = item.date ? new Date(item.date).toLocaleDateString() : 'Unknown';
        const formattedTime = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown';
        
        // Safely handle photo data
        const hasPhoto = item.photo && typeof item.photo === 'string' && item.photo.length > 0;
        
        return (
            <TouchableOpacity
                style={styles.lostItemContainer}
                onPress={() => navigation.navigate('ItemDetails', { itemId: item._id, itemType: 'lost' })}
            >
                <View style={styles.lostItemHeader}>
                    <Icon name="alert-circle-outline" size={24} color="#3d0c45" />
                    <Text style={styles.lostItemTitle}>{item.itemName || 'Lost Item'}</Text>
                </View>
                
                <View style={styles.lostItemDetails}>
                    {hasPhoto ? (
                        <Image 
                            source={{ uri: `data:image/jpeg;base64,${item.photo}` }}
                            style={styles.lostItemImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.lostItemImage, styles.noImagePlaceholder]}>
                            <Icon name="image-off" size={30} color="#ccc" />
                        </View>
                    )}
                    
                    <View style={styles.lostItemInfo}>
                        <View style={styles.detailRow}>
                            <Icon name="map-marker" size={16} color="#555" />
                            <Text style={styles.detailText}>{item.location || 'Unknown location'}</Text>
                        </View>
                        
                        <View style={styles.detailRow}>
                            <Icon name="calendar" size={16} color="#555" />
                            <Text style={styles.detailText}>{formattedDate}</Text>
                        </View>
                        
                        <View style={styles.detailRow}>
                            <Icon name="clock-outline" size={16} color="#555" />
                            <Text style={styles.detailText}>{formattedTime}</Text>
                        </View>
                        
                        <View style={styles.detailRow}>
                            <Icon name="tag" size={16} color="#555" />
                            <Text style={styles.detailText}>{item.category || 'Uncategorized'}</Text>
                        </View>
                    </View>
                </View>
                
                <TouchableOpacity 
                    style={styles.viewButtonContainer}
                    onPress={() => navigation.navigate('ItemDetails', { itemId: item._id, itemType: 'lost' })}
                >
                    <Text style={styles.viewButtonText}>View Lost Item Details</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    // Custom StatusBar component to ensure visibility
    const CustomStatusBar = ({backgroundColor, ...props}) => (
        <View style={[styles.statusBar, { backgroundColor }]}>
            <StatusBar translucent backgroundColor={backgroundColor} {...props} />
        </View>
    );

    return (
        <View style={styles.container}>
            <CustomStatusBar backgroundColor="#3d0c45" barStyle="light-content" />
            
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
                <TouchableOpacity
                    style={styles.markAllButton}
                    onPress={markAllAsRead}
                >
                    <Text style={styles.markAllText}>Mark all as read</Text>
                </TouchableOpacity>
            </View>

            {/* Main content container - scrollable to see all sections */}
            <FlatList
                ListHeaderComponent={() => (
                    <>
                        {/* Matches Section */}
                        <View style={styles.matchesSection}>
                <View style={styles.sectionHeader}>
                                <Icon name="target" size={24} color="#ff6b6b" />
                                <Text style={styles.sectionTitle}>Your Matches</Text>
                </View>
                
                            {loadingMatches ? (
                    <ActivityIndicator size="large" color="#3d0c45" style={styles.loader} />
                            ) : matches.length > 0 ? (
                    <FlatList
                                    data={matches}
                                    renderItem={renderMatchItem}
                        keyExtractor={item => item._id || Math.random().toString()}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                                    style={styles.matchesList}
                    />
                ) : (
                    <View style={styles.emptyContainer}>
                                    <Icon name="target-off" size={48} color="#666" />
                                    <Text style={styles.emptyText}>No matches found at this time</Text>
                        <TouchableOpacity
                            style={styles.refreshButton}
                                        onPress={() => fetchUserMatches(userId)}
                        >
                            <Text style={styles.refreshButtonText}>Refresh</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

                        {/* Match Notifications Section */}
                        <View style={styles.matchNotificationsSection}>
                <View style={styles.sectionHeader}>
                                <Icon name="target" size={24} color="#ff6b6b" />
                                <Text style={[styles.sectionTitle, styles.matchTitle]}>Matching Items ({matches.length})</Text>
                                
                                {/* Show match count badge */}
                                {matches.length > 0 && (
                                    <View style={styles.matchCountBadge}>
                                        <Text style={styles.matchCountText}>
                                            {matches.length}
                                        </Text>
                        </View>
                    )}
                </View>
                
                            {loading ? (
                                <ActivityIndicator size="large" color="#ff6b6b" style={styles.loader} />
                            ) : notifications.filter(n => n.type === 'match_found').length > 0 ? (
                                notifications.filter(n => n.type === 'match_found').map(item => (
                                    <View key={item._id} style={{marginBottom: 10}}>
                                        {renderNotification({item})}
                                    </View>
                                ))
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Icon name="target-off" size={48} color="#666" />
                                    <Text style={styles.emptyText}>No match notifications yet</Text>
                                </View>
                            )}
                        </View>

                        {/* All Lost Items Section */}
                        <View style={styles.lostItemsSection}>
                            <View style={styles.sectionHeader}>
                                <Icon name="alert-circle-outline" size={24} color="#3d0c45" />
                                <Text style={styles.sectionTitle}>All Lost Items ({allLostItems.length})</Text>
                            </View>
                            
                            {allLostItems.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Icon name="alert-off" size={48} color="#666" />
                                    <Text style={styles.emptyText}>No lost items found</Text>
                                </View>
                            ) : (
                <FlatList
                                    data={allLostItems}
                                    renderItem={renderLostItem}
                                    keyExtractor={item => item._id || Math.random().toString()}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.lostItemsList}
                                    contentContainerStyle={{paddingBottom: 10}}
                                />
                            )}
                        </View>
                        
                        {/* Other Notifications Section Header */}
                        <View style={styles.notificationsHeaderSection}>
                            <View style={styles.sectionHeader}>
                                <Icon name="bell-outline" size={24} color="#3d0c45" />
                                <Text style={styles.sectionTitle}>Recent Notifications</Text>
                            </View>
                        </View>
                    </>
                )}
                data={notifications.filter(n => n.type !== 'match_found')}
                    renderItem={renderNotification}
                    keyExtractor={item => item._id}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                        onRefresh={fetchNotifications}
                            colors={['#3d0c45']}
                        />
                    }
                onEndReached={() => {
                    if (!loading && hasMore) {
                        fetchNotifications(page + 1);
                    }
                }}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={
                        !loading && (
                            <View style={styles.emptyContainer}>
                                <Icon name="bell-off" size={48} color="#666" />
                            <Text style={styles.emptyText}>No general notifications yet</Text>
                            </View>
                        )
                    }
                    style={styles.notificationsList}
                />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingTop: STATUSBAR_HEIGHT, // Add padding for status bar
    },
    statusBar: {
        height: STATUSBAR_HEIGHT,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: STATUSBAR_HEIGHT + 8, // Adjust padding for status bar
        backgroundColor: '#3d0c45',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef'
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff'
    },
    markAllButton: {
        padding: 8
    },
    markAllText: {
        color: '#fff',
        fontSize: 14
    },
    // Lost Items Section
    matchesSection: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginLeft: 8,
    },
    matchesList: {
        minHeight: 220,
    },
    matchItemContainer: {
        width: 280,
        backgroundColor: '#f8f0ff',
        borderRadius: 8,
        padding: 12,
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    matchItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    matchItemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
        color: '#3d0c45',
    },
    matchItemDetails: {
        flexDirection: 'row',
    },
    matchItemImage: {
        width: 80,
        height: 80,
        borderRadius: 4,
        marginRight: 12,
    },
    matchItemInfo: {
        flex: 1,
    },
    matchItemBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ff6b6b',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 'auto',
    },
    loader: {
        marginVertical: 20,
    },
    // Notifications Section
    notificationsSection: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 16,
    },
    notificationsList: {
        flex: 1,
    },
    // Existing styles
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
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        textAlign: 'center'
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    detailText: {
        fontSize: 12,
        color: '#555',
        marginLeft: 4,
    },
    notificationDetails: {
        marginTop: 8,
        backgroundColor: '#f5f5f5',
        padding: 8,
        borderRadius: 4,
    },
    viewButtonContainer: {
        backgroundColor: '#3d0c45',
        padding: 8,
        borderRadius: 4,
        alignItems: 'center',
        marginTop: 8,
    },
    viewButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    noImagePlaceholder: {
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
    },
    refreshButton: {
        padding: 12,
        backgroundColor: '#3d0c45',
        borderRadius: 4,
        marginTop: 16
    },
    refreshButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500'
    },
    matchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    matchTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ff6b6b',
    },
    matchTitleText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
        color: '#ff6b6b',
    },
    matchIntro: {
        backgroundColor: '#f5f5f5',
        padding: 8,
        borderRadius: 4,
        marginBottom: 12,
    },
    matchIntroText: {
        fontSize: 14,
        color: '#3d0c45',
    },
    matchInfoContainer: {
        backgroundColor: '#f8f0ff',
        borderRadius: 4,
        padding: 8,
        marginBottom: 12,
    },
    matchScoreContainer: {
        marginTop: 8,
        backgroundColor: '#f5f5f5',
        padding: 8,
        borderRadius: 4,
    },
    matchScoreLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginBottom: 4,
    },
    scoreBar: {
        height: 12,
        backgroundColor: '#e9ecef',
        borderRadius: 6,
        marginBottom: 4,
    },
    scoreBarFill: {
        height: '100%',
        backgroundColor: '#3d0c45',
        borderRadius: 6,
    },
    scoreText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    descriptionContainer: {
        marginBottom: 8,
    },
    descriptionLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    descriptionText: {
        fontSize: 12,
        color: '#495057',
    },
    descriptionTextHighlighted: {
        fontSize: 12,
        color: '#3d0c45',
    },
    matchNotificationItem: {
        backgroundColor: '#f8f0ff',
        borderLeftWidth: 4,
        borderLeftColor: '#ff6b6b'
    },
    matchNotificationDetails: {
        marginTop: 8,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f0e0ff',
        shadowColor: '#3d0c45',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    matchButtonContainer: {
        backgroundColor: '#ff6b6b',
        padding: 8,
        borderRadius: 4,
        alignItems: 'center',
        marginTop: 8,
    },
    matchBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ff6b6b',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 'auto',
    },
    matchBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    viewMatchButton: {
        backgroundColor: '#ff6b6b',
        padding: 12,
        borderRadius: 6,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    viewMatchButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    matchBadgeInline: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ff6b6b',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 'auto',
    },
    matchBadgeTextInline: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    matchNotificationsSection: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 16,
    },
    matchNotificationsList: {
        flex: 1,
    },
    matchCountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ff6b6b',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 'auto',
    },
    matchCountText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    matchItemsInfo: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    matchItemColumn: {
        flex: 1,
        marginRight: 8,
    },
    matchItemColumnHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    matchItemColumnTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginLeft: 4,
    },
    matchItemName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    matchItemDescription: {
        fontSize: 12,
        color: '#495057',
    },
    matchItemDivider: {
        width: 1,
        height: '100%',
        backgroundColor: '#e9ecef',
        marginHorizontal: 8,
    },
    notificationsHeaderSection: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
    },
    lostItemsSection: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
    },
    lostItemsList: {
        minHeight: 220,
    },
    lostItemContainer: {
        width: 280,
        backgroundColor: '#f8f0ff',
        borderRadius: 8,
        padding: 12,
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    lostItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    lostItemTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
        color: '#3d0c45',
    },
    lostItemDetails: {
        flexDirection: 'row',
    },
    lostItemImage: {
        width: 80,
        height: 80,
        borderRadius: 4,
        marginRight: 12,
    },
    lostItemInfo: {
        flex: 1,
    },
    lostItemBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ff6b6b',
        borderRadius: 16,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 'auto',
    },
    lostItemBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    },
}); 