import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    Image, 
    TouchableOpacity, 
    ScrollView, 
    ActivityIndicator,
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
const ACTIVITY_STORAGE_KEY = 'user_activities'; // Same key as in Homepage.js

const MatchDetailsScreen = ({ route, navigation }) => {
    // Handle both direct navigation with IDs and navigation with match object
    const { match, lostItemId: routeLostItemId, foundItemId: routeFoundItemId } = route.params || {};
    
    const [loading, setLoading] = useState(true);
    const [lostItem, setLostItem] = useState(null);
    const [foundItem, setFoundItem] = useState(null);
    const [matchScore, setMatchScore] = useState(match ? match.matchConfidence : 0);
    const [userId, setUserId] = useState(null);
    const [matchStatus, setMatchStatus] = useState(match ? match.status : 'pending');
    
    useEffect(() => {
        // Get the user ID from AsyncStorage
        const getUserId = async () => {
            try {
                const userData = await AsyncStorage.getItem('userData');
                if (userData) {
                    const parsedUserData = JSON.parse(userData);
                    setUserId(parsedUserData._id);
                }
            } catch (error) {
                console.error('Error getting user data:', error);
            }
        };
        
        getUserId();
        
        // If match object is provided, use it directly
        if (match) {
            setUpMatchFromObject(match);
        } else if (routeLostItemId && routeFoundItemId) {
            // Otherwise fetch details using IDs
            fetchMatchDetails(routeLostItemId, routeFoundItemId);
        } else {
            // If neither is provided, use demo data
            setUpDemoData();
        }
    }, [match, routeLostItemId, routeFoundItemId]);
    
    const setUpMatchFromObject = (matchObj) => {
        console.log('Setting up match from object:', matchObj);
        
        // Create lostItem and foundItem objects from match data
        setLostItem({
            _id: matchObj.lostItemId,
            description: matchObj.lostItemDescription,
            category: matchObj.category || 'Personal Item',
            location: matchObj.lostLocation || 'Not specified',
            date: matchObj.lostDate || new Date().toISOString(),
            user: {
                _id: userId || 'u1',
                name: 'You',
                email: 'user@example.com'
            }
        });
        
        // Make sure we have the foundByUser data
        const foundByUser = matchObj.foundByUser || {};
        
        setFoundItem({
            _id: matchObj.foundItemId,
            description: matchObj.foundItemDescription,
            category: matchObj.category || 'Personal Item',
            location: matchObj.foundLocation || 'Not specified',
            date: matchObj.foundDate || new Date().toISOString(),
            contact: foundByUser.contact || matchObj.contact || 'Not provided',
            foundByUser: {
                id: foundByUser.id || 'unknown',
                name: foundByUser.name || 'Unknown User',
                avatar: foundByUser.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg'
            }
        });
        
        console.log('Founder data:', foundItem?.foundByUser);
        setLoading(false);
    };
    
    const setUpDemoData = () => {
        // Demo lost item
        setLostItem({
            _id: 'l1',
            description: 'Blue leather wallet with ID cards',
            category: 'Personal Item',
            location: 'University Campus',
            date: '2023-06-15T10:30:00Z',
            user: {
                _id: 'u1',
                name: 'You',
                email: 'user@example.com'
            }
        });
        
        // Demo found item
        setFoundItem({
            _id: 'f1',
            description: 'Blue wallet with ID cards',
            category: 'Personal Item',
            location: 'Central Park',
            date: '2023-06-15T14:45:00Z',
            user: {
                _id: 'u2',
                name: 'Jane Smith',
                avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
                email: 'jane@example.com'
            }
        });
        
        setMatchScore(92);
        setLoading(false);
    };
    
    const fetchMatchDetails = async (lostId, foundId) => {
        try {
            // Fetch lost item details
            const lostItemResponse = await axios.get(`${BACKEND_URL}/lostitem/${lostId}`);
            if (lostItemResponse.data.status === 'success') {
                setLostItem(lostItemResponse.data.item);
            } else {
                throw new Error('Failed to fetch lost item details');
            }
            
            // Fetch found item details
            const foundItemResponse = await axios.get(`${BACKEND_URL}/founditem/${foundId}`);
            if (foundItemResponse.data.status === 'success') {
                setFoundItem(foundItemResponse.data.item);
            } else {
                throw new Error('Failed to fetch found item details');
            }
            
            // Calculate match score
            if (lostItemResponse.data.item && foundItemResponse.data.item) {
                const score = calculateMatchScore(
                    lostItemResponse.data.item,
                    foundItemResponse.data.item
                );
                setMatchScore(score);
            }
        } catch (error) {
            console.error('Error fetching match details:', error);
            Alert.alert('Error', 'Failed to fetch match details. Please try again later.');
            
            // Only use demo data in development environment
            if (__DEV__) {
                console.log('Using demo data in development mode');
                setUpDemoData();
            } else {
                // Navigate back if we can't show the details
                Alert.alert('Error', 'Could not load match details', [
                    { text: 'Go Back', onPress: () => navigation.goBack() }
                ]);
            }
        } finally {
            setLoading(false);
        }
    };
    
    const calculateMatchScore = (lost, found) => {
        let score = 0;
        const maxScore = 100;
        
        // Description similarity score (up to 50 points)
        if (lost.description && found.description) {
            const descWords = lost.description.toLowerCase().split(/\s+/);
            const itemDescWords = found.description.toLowerCase().split(/\s+/);
            
            const matchingWords = descWords.filter(word => 
                word.length > 3 && itemDescWords.includes(word)
            ).length;
            
            const matchPercentage = matchingWords / Math.max(descWords.length, 1);
            score += matchPercentage * 50;
        }
        
        // Location similarity score (up to 30 points)
        if (lost.location && found.location) {
            const locParts = lost.location.toLowerCase().split(/,|\s+/);
            const itemLocParts = found.location.toLowerCase().split(/,|\s+/);
            
            const matchingParts = locParts.filter(part => 
                part.length > 2 && itemLocParts.includes(part)
            ).length;
            
            const matchPercentage = matchingParts / Math.max(locParts.length, 1);
            score += matchPercentage * 30;
        }
        
        // Date/time similarity score (up to 20 points)
        if (lost.date && found.date) {
            const lostDate = new Date(lost.date);
            const foundDate = new Date(found.date);
            
            // Calculate difference in hours
            const diffHours = Math.abs(foundDate - lostDate) / (1000 * 60 * 60);
            
            // Score decreases as time difference increases
            const timeScore = Math.max(0, 20 - (diffHours / 24) * 10);
            score += timeScore;
        }
        
        return Math.round(Math.min(score, maxScore));
    };
    
    const handleContactOwner = () => {
        if (!userId) {
            Alert.alert('Error', 'You need to be logged in to contact the owner.');
            return;
        }
        
        if (!foundItem || !foundItem.foundByUser) {
            Alert.alert('Error', 'Founder information is not available.');
            return;
        }
        
        console.log('Navigating to chat with:', foundItem.foundByUser);
        
        // Ensure we have a valid avatar URL
        const avatarUrl = foundItem.foundByUser?.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg';
        
        // Navigate to chat screen with the contact information
        navigation.navigate('ChatScreen', {
            recipientId: foundItem.foundByUser.id,
            recipientName: foundItem.foundByUser.name || 'Unknown User',
            recipientAvatar: avatarUrl,
            matchId: match?.id || 'unknown',
            itemDescription: foundItem.description || 'Found item',
            // Include additional context about the match
            matchContext: {
                matchConfidence: matchScore || 0,
                lostItemDescription: lostItem?.description || '',
                foundItemDescription: foundItem?.description || '',
                foundLocation: foundItem?.location || '',
                foundDate: foundItem?.date || ''
            }
        });
    };
    
    const handleConfirmMatch = () => {
        Alert.alert(
            'Confirm Match',
            'Are you sure this is your item? This will notify the finder.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Confirm',
                    onPress: () => {
                        setMatchStatus('confirmed');
                        // In a real app, you would update the match status in the backend
                        Alert.alert('Success', 'Match confirmed! The finder has been notified.');
                        
                        // Add to recent activity
                        addToRecentActivity();
                    }
                }
            ]
        );
    };
    
    const addToRecentActivity = async () => {
        try {
            // Get existing activities from AsyncStorage
            const storedActivities = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
            
            if (storedActivities) {
                let activities = JSON.parse(storedActivities);
                
                // Check if this match is already in activities
                const matchIndex = activities.findIndex(activity => 
                    (activity.id === match?.id) || 
                    (match?.lostItemId && activity.id === match.lostItemId)
                );
                
                if (matchIndex !== -1) {
                    // Update existing activity
                    activities[matchIndex] = {
                        ...activities[matchIndex],
                        status: 'matched',
                        date: 'Just now',
                        timestamp: new Date().toISOString()
                    };
                } else {
                    // Add new activity for this match
                    const newActivity = {
                        id: match?.id || `match-${Date.now()}`,
                        type: 'match',
                        title: lostItem?.description || 'Item matched',
                        status: 'matched',
                        location: foundItem?.location || 'Unknown location',
                        date: 'Just now',
                        timestamp: new Date().toISOString()
                    };
                    
                    // Add to beginning of array
                    activities.unshift(newActivity);
                }
                
                // Store updated activities
                await AsyncStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
                
                // Navigate back to previous screen after a short delay
                setTimeout(() => {
                    navigation.goBack();
                }, 1500);
            }
        } catch (error) {
            console.error('Error adding to recent activity:', error);
        }
    };
    
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    
    // Add this function to handle avatar loading errors
    const handleAvatarError = () => {
        console.log(`Avatar loading error for match details`);
        if (foundItem && foundItem.foundByUser) {
            setFoundItem({
                ...foundItem,
                foundByUser: {
                    ...foundItem.foundByUser,
                    avatar: 'https://randomuser.me/api/portraits/lego/1.jpg'
                }
            });
        }
    };
    
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Match Details</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3d0c45" />
                    <Text style={styles.loadingText}>Loading match details...</Text>
                </View>
            </SafeAreaView>
        );
    }
    
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Match Details</Text>
                <View style={{ width: 40 }} />
            </View>
            
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.matchScoreContainer}>
                    <View style={styles.matchScoreCircle}>
                        <Text style={styles.matchScoreValue}>{matchScore}%</Text>
                        <Text style={styles.matchScoreLabel}>Match</Text>
                    </View>
                    <View style={[styles.statusBadge, { 
                        backgroundColor: matchStatus === 'confirmed' ? '#4CAF50' : '#FFC107'
                    }]}>
                        <Text style={styles.statusText}>
                            {matchStatus === 'confirmed' ? 'Confirmed' : 'Pending'}
                        </Text>
                    </View>
                </View>
                
                <View style={styles.itemsContainer}>
                    <View style={styles.itemSection}>
                        <View style={styles.itemHeader}>
                            <View style={[styles.itemTypeTag, { backgroundColor: '#f8d7da' }]}>
                                <Ionicons name="search-outline" size={16} color="#dc3545" />
                                <Text style={[styles.itemTypeText, { color: '#dc3545' }]}>Lost Item</Text>
                            </View>
                            <Text style={styles.itemOwner}>Reported by: {lostItem?.user?.name || 'You'}</Text>
                        </View>
                        
                        <View style={styles.itemDetails}>
                            <Text style={styles.itemTitle}>{lostItem?.description}</Text>
                            
                            <View style={styles.detailRow}>
                                <Ionicons name="location-outline" size={20} color="#3d0c45" />
                                <Text style={styles.detailText}>{lostItem?.location || 'Location not specified'}</Text>
                            </View>
                            
                            <View style={styles.detailRow}>
                                <Ionicons name="time-outline" size={20} color="#3d0c45" />
                                <Text style={styles.detailText}>
                                    {lostItem?.date ? formatDate(lostItem.date) : 'Date not specified'}
                                </Text>
                            </View>
                            
                            <View style={styles.detailRow}>
                                <Ionicons name="pricetag-outline" size={20} color="#3d0c45" />
                                <Text style={styles.detailText}>{lostItem?.category || 'Category not specified'}</Text>
                            </View>
                        </View>
                    </View>
                    
                    <View style={styles.separator}>
                        <View style={styles.separatorLine} />
                        <Ionicons name="git-compare-outline" size={24} color="#3d0c45" />
                        <View style={styles.separatorLine} />
                    </View>
                    
                    <View style={styles.itemSection}>
                        <View style={styles.itemHeader}>
                            <View style={[styles.itemTypeTag, { backgroundColor: '#d1e7dd' }]}>
                                <Ionicons name="checkmark-circle-outline" size={16} color="#198754" />
                                <Text style={[styles.itemTypeText, { color: '#198754' }]}>Found Item</Text>
                            </View>
                            <Text style={styles.itemOwner}>Found by: {foundItem?.user?.name || 'Unknown'}</Text>
                        </View>
                        
                        <View style={styles.itemDetails}>
                            <Text style={styles.itemTitle}>{foundItem?.description}</Text>
                            
                            <View style={styles.detailRow}>
                                <Ionicons name="location-outline" size={20} color="#3d0c45" />
                                <Text style={styles.detailText}>{foundItem?.location || 'Location not specified'}</Text>
                            </View>
                            
                            <View style={styles.detailRow}>
                                <Ionicons name="time-outline" size={20} color="#3d0c45" />
                                <Text style={styles.detailText}>
                                    {foundItem?.date ? formatDate(foundItem.date) : 'Date not specified'}
                                </Text>
                            </View>
                            
                            <View style={styles.detailRow}>
                                <Ionicons name="pricetag-outline" size={20} color="#3d0c45" />
                                <Text style={styles.detailText}>{foundItem?.category || 'Category not specified'}</Text>
                            </View>
                        </View>
                    </View>
                </View>
                
                <View style={styles.founderSection}>
                    <Text style={styles.sectionTitle}>Found By</Text>
                    <View style={styles.founderCard}>
                        <View style={styles.avatarContainer}>
                            {foundItem?.foundByUser?.avatar ? (
                                <Image 
                                    source={{ uri: foundItem.foundByUser.avatar }} 
                                    style={styles.founderAvatar}
                                    onError={handleAvatarError}
                                />
                            ) : (
                                <View style={styles.placeholderAvatar}>
                                    <Text style={styles.avatarInitial}>
                                        {foundItem?.foundByUser?.name ? foundItem.foundByUser.name.charAt(0).toUpperCase() : '?'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.founderInfo}>
                            <Text style={styles.founderName}>{foundItem?.foundByUser?.name || 'Unknown User'}</Text>
                            <Text style={styles.founderContact}>Contact: {foundItem?.contact || 'Not provided'}</Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.contactButton}
                            onPress={handleContactOwner}
                        >
                            <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
                            <Text style={styles.contactButtonText}>Contact</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                
                <View style={styles.actionsContainer}>
                    {matchStatus === 'pending' && (
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.confirmButton]}
                            onPress={handleConfirmMatch}
                        >
                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                            <Text style={styles.actionButtonText}>Confirm Match</Text>
                        </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                        style={[styles.actionButton, styles.contactButtonLarge]}
                        onPress={handleContactOwner}
                    >
                        <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>Contact Finder</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#3d0c45',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    backButton: {
        padding: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
    },
    scrollView: {
        flex: 1,
    },
    matchScoreContainer: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e1e1',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    matchScoreCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#f0e6f2',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#3d0c45',
    },
    matchScoreValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    matchScoreLabel: {
        fontSize: 14,
        color: '#3d0c45',
    },
    statusBadge: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
    },
    itemsContainer: {
        padding: 16,
    },
    itemSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    itemTypeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    itemTypeText: {
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    itemOwner: {
        fontSize: 12,
        color: '#666',
    },
    itemDetails: {
        marginBottom: 8,
    },
    itemTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#666',
        flex: 1,
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 8,
    },
    separatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e1e1e1',
        marginHorizontal: 8,
    },
    founderSection: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    founderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        marginRight: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    founderAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
    },
    placeholderAvatar: {
        width: '100%',
        height: '100%',
        borderRadius: 30,
        backgroundColor: '#3d0c45',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    founderInfo: {
        flex: 1,
    },
    founderName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    founderContact: {
        fontSize: 14,
        color: '#666',
    },
    actionsContainer: {
        padding: 16,
        marginBottom: 24,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
        marginBottom: 12,
    },
    confirmButton: {
        backgroundColor: '#4CAF50',
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3d0c45',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    contactButtonLarge: {
        backgroundColor: '#3d0c45',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
        marginBottom: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginLeft: 8,
    },
    contactButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        marginLeft: 8,
    },
});

export default MatchDetailsScreen; 