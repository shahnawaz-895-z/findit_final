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

// Get the status bar height for proper padding
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

export default function NotificationsScreen({ navigation }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [lastPolled, setLastPolled] = useState(Date.now());
    const isFocused = useIsFocused();
    const [lostItems, setLostItems] = useState([]);
    const [loadingLostItems, setLoadingLostItems] = useState(true);

    // Get userId from storage
    const getUserId = async () => {
        try {
            console.log('Getting userData from AsyncStorage');
            const userData = await AsyncStorage.getItem('userData');
            console.log('userData from storage:', userData);
            
            if (!userData) {
                console.log('No userData found in AsyncStorage');
                
                // Try to get user ID from token as fallback
                try {
                    const token = await AsyncStorage.getItem('authToken');
                    if (token) {
                        console.log('Token found, will use this for authenticated requests');
                        // We don't extract userId from token here, just acknowledge we have a token
                        // for authenticated requests
                    } else {
                        console.log('No auth token found in AsyncStorage');
                    }
                } catch (tokenError) {
                    console.error('Error getting authToken:', tokenError);
                }
                
                return null;
            }
            
            try {
                const parsedData = JSON.parse(userData);
                console.log('Parsed userData:', parsedData);
                
                if (parsedData && parsedData._id) {
                    console.log('Found userId:', parsedData._id);
                    return parsedData._id;
                } else {
                    console.log('userData exists but contains no _id property');
                    return null;
                }
            } catch (parseError) {
                console.error('Error parsing userData JSON:', parseError);
                console.log('Raw userData content:', userData);
                return null;
            }
        } catch (error) {
            console.error('Error getting userId from AsyncStorage:', error);
            return null;
        }
    };

    // Fetch all lost items
    const fetchAllLostItems = async () => {
        try {
            setLoadingLostItems(true);
            console.log('Fetching all lost items...');
            console.log('API URL:', API_CONFIG.API_URL);
            
            // Use simple fetch without special headers or options to troubleshoot
            const response = await fetch(`${API_CONFIG.API_URL}/all-lost-items`);
            console.log('Response status:', response.status);
            
            // If the response is not OK, try the alternate URL
            if (!response.ok) {
                console.log('First attempt failed, trying alternate URL...');
                const altResponse = await fetch(`${API_CONFIG.API_URL}/api/all-lost-items`);
                
                if (!altResponse.ok) {
                    console.error('Both attempts failed');
                    setLostItems([]);
                    setLoadingLostItems(false);
                    return;
                }
                
                const data = await altResponse.json();
                console.log('Got data from alternate URL:', data.count || 0, 'items');
                setLostItems(data.items || []);
                setLoadingLostItems(false);
                return;
            }
            
            const data = await response.json();
            console.log('Got data from primary URL:', data.count || 0, 'items');
            setLostItems(data.items || []);
        } catch (error) {
            console.error('Error fetching all lost items:', error.message);
            setLostItems([]);
        } finally {
            setLoadingLostItems(false);
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

            const url = `${API_CONFIG.API_URL}/api/notifications/${userId}?page=${pageNum}&limit=20`;
            console.log('Fetching notifications from:', url);
            
            const response = await fetch(url);
            const data = await response.json();
            console.log('Notifications response status:', response.status);
            
            if (!response.ok) {
                console.error('Failed to fetch notifications:', data);
                throw new Error(data.error || 'Failed to fetch notifications');
            }

            const notificationsList = data.notifications || [];
            console.log('Received notifications count:', notificationsList.length);
            
            // Process match notifications to ensure descriptions are available
            const processedNotifications = notificationsList.map(notification => {
                if (notification.type === 'match_found') {
                    console.log(`Processing match notification ${notification._id}`);
                    
                    // Make a deep copy to avoid reference issues
                    const processedNotification = {...notification};
                    
                    // Ensure lost item description exists
                    if (!processedNotification.lostItemDescription) {
                        console.log('Lost item description missing, using fallback');
                        processedNotification.lostItemDescription = "Description not available";
                    }
                    
                    // Ensure found item description exists
                    if (!processedNotification.foundItemDescription) {
                        console.log('Found item description missing, using fallback');
                        processedNotification.foundItemDescription = "Description not available";
                    }
                    
                    // Ensure other required fields exist
                    if (!processedNotification.lostItemName) {
                        processedNotification.lostItemName = "Lost Item";
                    }
                    
                    if (!processedNotification.foundItemName) {
                        processedNotification.foundItemName = "Found Item";
                    }
                    
                    // Log the processed notification details
                    console.log('Processed match notification:', JSON.stringify({
                        id: processedNotification._id,
                        type: processedNotification.type,
                        lostItemName: processedNotification.lostItemName || 'Unnamed item',
                        lostItemDesc: processedNotification.lostItemDescription ? 
                            (processedNotification.lostItemDescription.substring(0, 20) + '...') : 'Missing',
                        foundItemName: processedNotification.foundItemName || 'Unnamed item',
                        foundItemDesc: processedNotification.foundItemDescription ? 
                            (processedNotification.foundItemDescription.substring(0, 20) + '...') : 'Missing'
                    }, null, 2));
                    
                    return processedNotification;
                }
                return notification;
            });
            
            // Check specifically for match notifications
            const matchNotifications = processedNotifications.filter(n => n.type === 'match_found');
            console.log('Match notifications found:', matchNotifications.length);
            if (matchNotifications.length > 0) {
                console.log('First match notification:', JSON.stringify({
                    id: matchNotifications[0]._id,
                    matchId: matchNotifications[0].matchId,
                    lostItemDescription: matchNotifications[0].lostItemDescription ? 'Present' : 'Missing',
                    foundItemDescription: matchNotifications[0].foundItemDescription ? 'Present' : 'Missing'
                }, null, 2));
            }
            
            setNotifications(prev => 
                shouldRefresh ? processedNotifications : [...prev, ...processedNotifications]
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

            const url = `${API_CONFIG.API_URL}/api/notifications/poll/${userId}?lastPolled=${lastPolled}`;
            console.log('Polling notifications from:', url);
            
            const response = await fetch(url);
            const data = await response.json();
            console.log('Polling response status:', response.status);

            if (!response.ok) throw new Error(data.error || 'Failed to fetch notifications');

            const newNotifications = data.notifications || [];
            console.log('Received new notifications:', newNotifications.length);
            
            // Process any match notifications to ensure descriptions are available
            const processedNewNotifications = newNotifications.map(notification => {
                if (notification.type === 'match_found') {
                    console.log(`Processing new match notification ${notification._id}`);
                    
                    // Make a deep copy to avoid reference issues
                    const processedNotification = {...notification};
                    
                    // Ensure lost item description exists
                    if (!processedNotification.lostItemDescription) {
                        console.log('Lost item description missing in new notification, using fallback');
                        processedNotification.lostItemDescription = "Description not available";
                    }
                    
                    // Ensure found item description exists
                    if (!processedNotification.foundItemDescription) {
                        console.log('Found item description missing in new notification, using fallback');
                        processedNotification.foundItemDescription = "Description not available";
                    }
                    
                    // Ensure other required fields exist
                    if (!processedNotification.lostItemName) {
                        processedNotification.lostItemName = "Lost Item";
                    }
                    
                    if (!processedNotification.foundItemName) {
                        processedNotification.foundItemName = "Found Item";
                    }
                    
                    return processedNotification;
                }
                return notification;
            });
            
            // Log match notifications
            const newMatchNotifications = processedNewNotifications.filter(n => n.type === 'match_found');
            if (newMatchNotifications.length > 0) {
                console.log(`Received ${newMatchNotifications.length} new match notifications`);
                console.log('First new match notification:', JSON.stringify({
                    id: newMatchNotifications[0]._id,
                    matchId: newMatchNotifications[0].matchId,
                    lostItemDesc: newMatchNotifications[0].lostItemDescription ? 'Present' : 'Missing',
                    foundItemDesc: newMatchNotifications[0].foundItemDescription ? 'Present' : 'Missing'
                }, null, 2));
            }
            
            if (processedNewNotifications.length > 0) {
                setNotifications(prev => {
                    const allNotifications = [...processedNewNotifications, ...prev];
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

    // Setup polling
    useEffect(() => {
        let pollTimer;

        if (isFocused) {
            pollTimer = setInterval(pollNotifications, API_CONFIG.POLLING_INTERVAL);
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
            fetchAllLostItems();
        }
    }, [isFocused]);

    // Handle refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNotifications(1, true);
        fetchAllLostItems();
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
                case 'lost_item_report':
                    return 'alert-outline';
                case 'lost_item_repost':
                    return 'alert-circle-outline';
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
                console.log('Match notification pressed, details:', JSON.stringify(notification, null, 2));
                
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
            } else if ((notification.type === 'lost_item_report' || notification.type === 'lost_item_repost') && notification.lostItemId) {
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

        // Format additional details for item notifications
        const renderAdditionalDetails = (notification) => {
            if (notification.type === 'lost_item_report' || notification.type === 'lost_item_repost') {
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
                console.log('Rendering match notification:', JSON.stringify({
                    id: notification._id,
                    matchId: notification.matchId,
                    matchDate: notification.matchDate,
                    lostItemId: notification.lostItemId,
                    foundItemId: notification.foundItemId,
                }));
                
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
                const isLostItemUser = !!notification.lostItemId;
                const isFoundItemUser = !!notification.foundItemId;
                
                return (
                    <View style={styles.matchNotificationDetails}>
                        <View style={styles.matchHeader}>
                            <Icon name="target" size={20} color="#ff6b6b" />
                            <Text style={styles.matchTitleText}>Match Found!</Text>
                        </View>
                        
                        <View style={styles.matchIntro}>
                            {isLostItemUser ? (
                                <Text style={styles.matchIntroText}>
                                    Someone found an item that matches your lost {notification.lostItemName || "item"}!
                                </Text>
                            ) : (
                                <Text style={styles.matchIntroText}>
                                    Your found item matches with someone's lost item!
                                </Text>
                            )}
                        </View>
                        
                        <View style={styles.matchInfoContainer}>
                            {/* Item Name */}
                            <View style={styles.detailRow}>
                                <Icon name="information-outline" size={16} color="#555" />
                                <Text style={styles.detailText}>
                                    <Text style={{fontWeight: 'bold'}}>
                                        {isLostItemUser ? "Your lost item: " : "Your found item: "}
                                    </Text>
                                    {isLostItemUser 
                                        ? notification.lostItemName || "Your lost item" 
                                        : notification.foundItemName || "Your found item"}
                                </Text>
                            </View>
                            
                            {/* Matching Item */}
                            <View style={styles.detailRow}>
                                <Icon name="swap-horizontal" size={16} color="#555" />
                                <Text style={styles.detailText}>
                                    <Text style={{fontWeight: 'bold'}}>
                                        {isLostItemUser ? "Matches with found item: " : "Matches with lost item: "}
                                    </Text>
                                    {isLostItemUser 
                                        ? notification.foundItemName || "Found item" 
                                        : notification.lostItemName || "Lost item"}
                                </Text>
                            </View>
                            
                            {/* Match Time */}
                            <View style={styles.detailRow}>
                                <Icon name="clock-outline" size={16} color="#555" />
                                <Text style={styles.detailText}>
                                    <Text style={{fontWeight: 'bold'}}>Match time: </Text>
                                    {matchDate}
                                </Text>
                            </View>
                        </View>
                        
                        <TouchableOpacity 
                            style={styles.matchButtonContainer}
                            onPress={() => {
                                console.log('View Match Details button pressed');
                                console.log('Notification matchId:', matchId);
                                markAsRead(notification._id);
                                if (matchId) {
                                    console.log('Navigating to MatchDetailsScreen with matchId:', matchId);
                                    navigation.navigate('MatchDetailsScreen', { matchId: matchId });
                                } else {
                                    console.log('No matchId available, cannot navigate');
                                    Alert.alert(
                                        "Navigation Error", 
                                        "Cannot view match details - match ID is missing."
                                    );
                                }
                            }}
                        >
                            <Text style={styles.viewButtonText}>View Match Details</Text>
                        </TouchableOpacity>
                    </View>
                );
            }
            return null;
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
                            {item.title}
                        </Text>
                        <Text style={styles.message}>{item.message}</Text>
                        {renderAdditionalDetails(item)}
                        <Text style={styles.time}>
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </Text>
                    </View>
                </View>
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
                    <Icon name="alert-outline" size={24} color="#3d0c45" />
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
                    <Text style={styles.viewButtonText}>View Details</Text>
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

            {/* Lost Items Section */}
            <View style={styles.lostItemsSection}>
                <View style={styles.sectionHeader}>
                    <Icon name="alert-circle-outline" size={24} color="#3d0c45" />
                    <Text style={styles.sectionTitle}>Lost Items</Text>
                </View>
                
                {loadingLostItems ? (
                    <ActivityIndicator size="large" color="#3d0c45" style={styles.loader} />
                ) : lostItems.length > 0 ? (
                    <FlatList
                        data={lostItems}
                        renderItem={renderLostItem}
                        keyExtractor={item => item._id || Math.random().toString()}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.lostItemsList}
                    />
                ) : (
                    <View style={styles.emptyContainer}>
                        <Icon name="magnify" size={48} color="#666" />
                        <Text style={styles.emptyText}>No lost items found at this time</Text>
                        <TouchableOpacity
                            style={styles.refreshButton}
                            onPress={fetchAllLostItems}
                        >
                            <Text style={styles.refreshButtonText}>Refresh</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Notifications Section */}
            <View style={styles.notificationsSection}>
                <View style={styles.sectionHeader}>
                    <Icon name="bell-outline" size={24} color="#3d0c45" />
                    <Text style={styles.sectionTitle}>Recent Notifications</Text>
                    
                    {/* Match indicator badge */}
                    {notifications.some(n => n.type === 'match_found') && (
                        <View style={styles.matchBadge}>
                            <Icon name="target" size={14} color="#fff" />
                            <Text style={styles.matchBadgeText}>Matches</Text>
                        </View>
                    )}
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
                    style={styles.notificationsList}
                />
            </View>
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
    lostItemsSection: {
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
}); 