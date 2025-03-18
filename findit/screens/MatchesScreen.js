import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    Image, 
    TouchableOpacity, 
    Alert,
    Dimensions,
    ActivityIndicator,
    SafeAreaView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';

const { width, height } = Dimensions.get('window');
const BACKEND_URL = API_CONFIG.API_URL; // Using centralized config

const MatchesScreen = ({ route, navigation }) => {
    // Handle case when navigating directly from homepage
    const routeParams = route.params || {};
    const { matches: routeMatches, lostItemId, lostItemDescription } = routeParams;
    
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [matches, setMatches] = useState(routeMatches || []);
    const [stats, setStats] = useState({
        totalMatches: 0,
        pendingMatches: 0,
        confirmedMatches: 0
    });
    
    useEffect(() => {
        // Get the user ID from AsyncStorage
        const getUserId = async () => {
            try {
                const userData = await AsyncStorage.getItem('userData');
                if (userData) {
                    const parsedUserData = JSON.parse(userData);
                    setUserId(parsedUserData._id);
                    console.log('User ID retrieved:', parsedUserData._id);
                    
                    // If no matches were passed via route params, fetch all matches for the user
                    if (!routeMatches) {
                        fetchUserMatches(parsedUserData._id);
                    } else {
                        setLoading(false);
                        updateStats(routeMatches);
                    }
                } else {
                    console.log('No user data found, using demo data');
                    // Demo data if no user is logged in
                    setDemoData();
                }
            } catch (error) {
                console.error('Error getting user data:', error);
                // Demo data if there's an error
                setDemoData();
            }
        };
        
        getUserId();
    }, [routeMatches]);
    
    const fetchUserMatches = async (userId) => {
        try {
            setLoading(true);
            console.log('Fetching matches for user ID:', userId);
            
            // Set a timeout to handle slow connections
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 15000)
            );
            
            // Actual fetch request
            const fetchPromise = axios.get(`${BACKEND_URL}/user-matches/${userId}`);
            
            // Race between timeout and fetch
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            console.log('Matches API response received:', response.data);
            
            let processedMatches = [];
            
            if (response.data) {
                // Handle different response structures
                if (Array.isArray(response.data.matches)) {
                    // New API structure with matches array
                    processedMatches = response.data.matches;
                    console.log(`Processing ${processedMatches.length} matches from new API structure`);
                } else if (Array.isArray(response.data)) {
                    // API might return array directly
                    processedMatches = response.data;
                    console.log(`Processing ${processedMatches.length} matches from direct array response`);
                } else if (response.data.matches) {
                    // Handle potential object response
                    processedMatches = [response.data.matches];
                    console.log('Processing single match object');
                } else {
                    // Try to find any usable data in the response
                    console.warn('Unexpected API response structure:', JSON.stringify(response.data).substring(0, 200) + '...');
                    
                    // Check various possible locations for match data
                    if (response.data.data && Array.isArray(response.data.data)) {
                        processedMatches = response.data.data;
                        console.log(`Found ${processedMatches.length} matches in response.data.data`);
                    } else if (response.data.results && Array.isArray(response.data.results)) {
                        processedMatches = response.data.results;
                        console.log(`Found ${processedMatches.length} matches in response.data.results`);
                    } else if (response.data.status === 'success' && response.data.totalMatches === 0) {
                        // Valid response but no matches found
                        console.log('No matches found for this user');
                        setMatches([]);
                        updateStats([]);
                        setLoading(false);
                        return;
                    } else {
                        console.error('No usable match data found in API response');
                        // Set demo data as fallback
                        setDemoData();
                        return;
                    }
                }
                
                // Step 1: Ensure each match has a unique ID
                // If we have item IDs, create consistent IDs for match pairs
                processedMatches = processedMatches.map((match, index) => {
                    // If no ID is present, create one
                    if (!match.id && !match._id) {
                        // Try to create a consistent ID from item IDs if available
                        if (match.lostItem && match.foundItem) {
                            const lostId = match.lostItem._id || match.lostItem.id || '';
                            const foundId = match.foundItem._id || match.foundItem.id || '';
                            
                            if (lostId && foundId) {
                                // Use smaller ID first to ensure consistency regardless of order
                                const smallerId = String(lostId) < String(foundId) ? lostId : foundId;
                                const largerId = String(lostId) > String(foundId) ? lostId : foundId;
                                match._id = `${smallerId}_${largerId}`;
                            } else {
                                match._id = `match_${index}_${Date.now()}`;
                            }
                        } else if (match.lostItemId && match.foundItemId) {
                            // For old format
                            const smallerId = String(match.lostItemId) < String(match.foundItemId) 
                                ? match.lostItemId : match.foundItemId;
                            const largerId = String(match.lostItemId) > String(match.foundItemId) 
                                ? match.lostItemId : match.foundItemId;
                            match._id = `${smallerId}_${largerId}`;
                        } else {
                            match._id = `match_${index}_${Date.now()}`;
                        }
                    }
                    return match;
                });
                
                // Step 2: Filter out duplicates using the match IDs
                const uniqueMatches = [];
                const seenIds = new Set();
                
                for (const match of processedMatches) {
                    const matchId = match._id || match.id;
                    if (!seenIds.has(matchId)) {
                        uniqueMatches.push(match);
                        seenIds.add(matchId);
                    } else {
                        console.log(`Filtering out duplicate match with ID: ${matchId}`);
                    }
                }
                
                // Add basic validation - only include matches with required fields
                const validMatches = uniqueMatches.filter(match => {
                    // For new structure
                    if (match.lostItem || match.foundItem) {
                        return true;
                    }
                    
                    // For old structure, check if essential fields exist
                    return match.foundItemDescription || match.lostItemDescription;
                });
                
                // Sort by match confidence/score
                validMatches.sort((a, b) => {
                    // For new structure
                    if (a.matchScore !== undefined && b.matchScore !== undefined) {
                        return b.matchScore - a.matchScore;
                    }
                    
                    // For old structure
                    return (b.matchConfidence || 0) - (a.matchConfidence || 0);
                });
                
                console.log(`Setting ${validMatches.length} processed matches after deduplication`);
                setMatches(validMatches);
                updateStats(validMatches);
            } else {
                console.log('No data found in response');
                setMatches([]);
                updateStats([]);
            }
        } catch (error) {
            console.error('Error fetching matches:', error);
            
            // Check if the error is a timeout
            const errorMessage = error.message || 'Unknown error';
            let displayMessage = 'Failed to fetch matches. Please try again later.';
            
            if (errorMessage.includes('timeout')) {
                displayMessage = 'Request timed out. The server might be busy or unavailable.';
            } else if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                if (error.response.status === 401) {
                    displayMessage = 'You need to be logged in to view matches.';
                } else if (error.response.status === 500) {
                    displayMessage = 'Server error. Our team has been notified.';
                }
                console.error('Server response:', error.response.data);
            }
            
            Alert.alert(
                'Error',
                displayMessage,
                [{ text: 'OK' }]
            );
            
            // For demo purposes, load some sample data
            console.log('Loading demo data instead');
            setDemoData();
        } finally {
            setLoading(false);
        }
    };
    
    const setDemoData = () => {
        const demoMatches = [
            {
                id: '1',
                foundItemId: 'f1',
                lostItemId: 'l1',
                foundItemDescription: 'Blue wallet with ID cards',
                lostItemDescription: 'Lost blue leather wallet',
                foundDate: '2023-06-15',
                foundLocation: 'Central Park',
                matchConfidence: 92,
                status: 'pending',
                foundByUser: {
                    id: 'u2',
                    name: 'Jane Smith',
                    avatar: 'https://randomuser.me/api/portraits/women/44.jpg'
                }
            },
            {
                id: '2',
                foundItemId: 'f2',
                lostItemId: 'l2',
                foundItemDescription: 'iPhone 13 Pro, black color',
                lostItemDescription: 'Lost iPhone 13 Pro',
                foundDate: '2023-06-10',
                foundLocation: 'Coffee Shop',
                matchConfidence: 88,
                status: 'confirmed',
                foundByUser: {
                    id: 'u3',
                    name: 'Mike Johnson',
                    avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
                }
            },
            {
                id: '3',
                foundItemId: 'f3',
                lostItemId: 'l3',
                foundItemDescription: 'Car keys with Honda keychain',
                lostItemDescription: 'Lost car keys',
                foundDate: '2023-06-18',
                foundLocation: 'Shopping Mall',
                matchConfidence: 75,
                status: 'pending',
                foundByUser: {
                    id: 'u4',
                    name: 'Sarah Williams',
                    avatar: 'https://randomuser.me/api/portraits/women/67.jpg'
                }
            }
        ];
        
        setMatches(demoMatches);
        updateStats(demoMatches);
    };
    
    const updateStats = (matchesData) => {
        const totalMatches = matchesData.length;
        const pendingMatches = matchesData.filter(match => match.status === 'pending').length;
        const confirmedMatches = matchesData.filter(match => match.status === 'confirmed').length;
        
        setStats({
            totalMatches,
            pendingMatches,
            confirmedMatches
        });
    };
    
    const handleContactOwner = (item) => {
        if (!userId) {
            Alert.alert('Error', 'You need to be logged in to contact the owner.');
            return;
        }
        
        // Validate the foundByUser object
        if (!item.foundByUser || !item.foundByUser.id) {
            console.error('Invalid foundByUser data:', item.foundByUser);
            Alert.alert('Error', 'Cannot contact this user. Missing contact information.');
            return;
        }
        
        console.log('Navigating to chat with:', item.foundByUser);
        
        // Ensure we have a valid avatar URL
        const avatarUrl = item.foundByUser?.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg';
        
        // Ensure we have a valid name
        const userName = item.foundByUser?.name || 'Unknown User';
        
        // Log the data being passed to ChatScreen
        console.log('Passing to ChatScreen:', {
            recipientId: item.foundByUser.id,
            recipientName: userName,
            avatarUrl: avatarUrl,
            matchId: item.id
        });
        
        // Navigate to chat screen with the contact information and match details
        navigation.navigate('ChatScreen', {
            recipientId: item.foundByUser.id,
            recipientName: userName,
            recipientAvatar: avatarUrl,
            matchId: item.id || 'unknown',
            itemDescription: item.foundItemDescription || 'Found item',
            // Include comprehensive match context
            matchContext: {
                matchConfidence: item.matchConfidence || 0,
                lostItemDescription: item.lostItemDescription || '',
                foundItemDescription: item.foundItemDescription || '',
                foundLocation: item.foundLocation || '',
                foundDate: item.foundDate || '',
                lostItemId: item.lostItemId || '',
                foundItemId: item.foundItemId || '',
                userId: userId, // Add sender's user ID
                foundByUserId: item.foundByUser.id // Add recipient's user ID
            }
        });
    };
    
    // Add this function to handle avatar loading errors
    const handleAvatarError = (item) => {
        console.log(`Avatar loading error for user: ${item.foundByUser?.id}`);
        // Update the item's avatar URL to use a default
        const updatedMatches = matches.map(match => {
            if (match.id === item.id) {
                return {
                    ...match,
                    foundByUser: {
                        ...match.foundByUser,
                        avatar: 'https://randomuser.me/api/portraits/lego/1.jpg'
                    }
                };
            }
            return match;
        });
        setMatches(updatedMatches);
    };
    
    // Add this helper function for rendering images
    const renderUserAvatar = (avatarUrl, userId) => {
        console.log(`Rendering avatar for user ${userId}:`, avatarUrl.substring(0, 30) + '...');
        return (
            <View style={styles.avatar}>
                <Image 
                    source={{ uri: avatarUrl }}
                    style={{width: '100%', height: '100%'}}
                    onError={(e) => {
                        console.log(`Error loading avatar: ${e.nativeEvent.error}`);
                        // Handle the error by falling back to a default image
                    }}
                />
            </View>
        );
    };
    
    const renderMatchItem = ({ item }) => {
        console.log('Rendering match item:', item);
        
        // Handle both new data structure (with lostItem/foundItem) and old structure
        // Based on whether this is the new or old data structure
        if (item.lostItem || item.foundItem) {
            // New data structure with separate lostItem and foundItem objects
            const isLostItem = Boolean(item.lostItem);
            const itemData = isLostItem ? item.lostItem : item.foundItem;
            const otherItem = isLostItem ? item.foundItem : item.lostItem;
            const otherUser = isLostItem ? item.foundItemUser : item.lostItemUser;
            
            if (!itemData || !otherUser) {
                console.error('Missing required item data or user data', { itemData, otherUser });
                return (
                    <View style={styles.errorMatchItem}>
                        <Text style={styles.errorText}>Error loading match data</Text>
                    </View>
                );
            }
            
            const categoryAttributes = renderCategoryAttributes(itemData);
            const matchScore = item.matchScore || Math.round(Math.random() * 50) + 50; // Fallback score
            
            // Get the matching attributes that contributed to this match
            const matchingAttributes = getMatchingAttributes(item.lostItem, item.foundItem, item.matchDetails);

            return (
                <TouchableOpacity
                    style={styles.matchItem}
                    onPress={() => navigation.navigate('ChatScreen', {
                        matchId: item._id || 'unknown',
                        otherUserId: otherUser._id || 'unknown',
                        otherUserName: otherUser.name || 'Unknown User',
                        otherUserAvatar: otherUser.profileImage || 'https://via.placeholder.com/40',
                        itemName: itemData.itemName || 'Unnamed Item',
                        itemPhoto: itemData.photo || 'https://via.placeholder.com/80',
                        matchScore: matchScore
                    })}
                >
                    <View style={styles.matchHeader}>
                        <Text style={styles.matchType}>
                            {isLostItem ? 'Found Your Item' : 'Found a Match'}
                        </Text>
                        <Text style={styles.matchScore}>
                            {matchScore}% Match
                        </Text>
                    </View>

                    <View style={styles.matchContent}>
                        <Image
                            source={{ uri: itemData.photo || 'https://via.placeholder.com/80' }}
                            style={styles.itemImage}
                        />
                        <View style={styles.itemDetails}>
                            <Text style={styles.itemName}>{itemData.itemName || 'Unnamed Item'}</Text>
                            <Text style={styles.itemCategory}>{itemData.category || 'Uncategorized'}</Text>
                            
                            {/* Display category-specific attributes */}
                            {categoryAttributes}
                            
                            {/* Display matching attributes if available */}
                            {matchingAttributes.length > 0 && (
                                <View style={styles.matchingAttributesContainer}>
                                    <Text style={styles.matchingAttributesTitle}>Matching Attributes:</Text>
                                    {matchingAttributes.map((attr, index) => (
                                        <Text key={index} style={styles.matchingAttribute}>✓ {attr}</Text>
                                    ))}
                                </View>
                            )}

                            <Text style={styles.itemDescription} numberOfLines={2}>
                                {itemData.description || 'No description available'}
                            </Text>
                            <Text style={styles.itemLocation}>Location: {itemData.location || 'Unknown'}</Text>
                            <Text style={styles.itemDate}>
                                {isLostItem ? 'Found on: ' : 'Lost on: '}
                                {itemData.date ? new Date(itemData.date).toLocaleDateString() : 'Unknown date'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.matchFooter}>
                        <View style={styles.userInfo}>
                            <Image
                                source={{ uri: otherUser.profileImage || 'https://via.placeholder.com/40' }}
                                style={styles.userAvatar}
                            />
                            <Text style={styles.userName}>{otherUser.name || 'Unknown User'}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.chatButton}
                            onPress={() => navigation.navigate('ChatScreen', {
                                matchId: item._id || 'unknown',
                                otherUserId: otherUser._id || 'unknown',
                                otherUserName: otherUser.name || 'Unknown User',
                                otherUserAvatar: otherUser.profileImage || 'https://via.placeholder.com/40',
                                itemName: itemData.itemName || 'Unnamed Item',
                                itemPhoto: itemData.photo || 'https://via.placeholder.com/80',
                                matchScore: matchScore
                            })}
                        >
                            <Text style={styles.chatButtonText}>Chat</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            );
        } else {
            // Old data structure
            // Extract data from the old format and render it
            const avatarUrl = item.foundByUser?.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg';
            const matchConfidence = item.matchConfidence || Math.round(Math.random() * 50) + 50;
            
            return (
                <TouchableOpacity
                    style={styles.matchItem}
                    onPress={() => handleContactOwner(item)}
                >
                    <View style={styles.matchHeader}>
                        <View style={styles.userInfo}>
                            <Image
                                source={{ uri: avatarUrl }}
                                style={styles.avatar}
                                onError={(e) => {
                                    console.error('Error loading avatar:', e.nativeEvent?.error);
                                    handleAvatarError(item);
                                }}
                            />
                            <View style={styles.userDetails}>
                                <Text style={styles.userName}>
                                    {item.foundByUser?.name || 'Unknown User'}
                                </Text>
                                <Text style={styles.matchConfidence}>
                                    Match Confidence: {matchConfidence}%
                                </Text>
                            </View>
                        </View>
                        <View style={styles.matchStatus}>
                            <Text style={[
                                styles.statusText,
                                { color: item.status === 'confirmed' ? '#28a745' : '#ffc107' }
                            ]}>
                                {item.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.matchDetails}>
                        <View style={styles.itemDetail}>
                            <Text style={styles.itemLabel}>Found Item:</Text>
                            <Text style={styles.itemDescription}>{item.foundItemDescription || 'No description'}</Text>
                            <Text style={styles.itemMeta}>
                                Found at {item.foundLocation || 'unknown location'} on {item.foundDate ? new Date(item.foundDate).toLocaleDateString() : 'unknown date'}
                            </Text>
                        </View>
                        
                        <View style={styles.itemDetail}>
                            <Text style={styles.itemLabel}>Lost Item:</Text>
                            <Text style={styles.itemDescription}>
                                {item.lostItemDescription || 'No description'}
                            </Text>
                            <Text style={styles.debugInfo}>
                                Lost Item ID: {item.lostItemId ? item.lostItemId.toString().substring(0, 8) + '...' : 'unknown'}{'\n'}
                                Found Item ID: {item.foundItemId ? item.foundItemId.toString().substring(0, 8) + '...' : 'unknown'}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }
    };
    
    // Helper function to render category-specific attributes
    const renderCategoryAttributes = (item) => {
        if (!item || !item.category) return null;

        switch (item.category) {
            case 'Electronics':
                return (
                    <View style={styles.attributesContainer}>
                        {item.brand && (
                            <Text style={styles.attribute}>Brand: {item.brand}</Text>
                        )}
                        {item.model && (
                            <Text style={styles.attribute}>Model: {item.model}</Text>
                        )}
                        {item.color && (
                            <Text style={styles.attribute}>Color: {item.color}</Text>
                        )}
                        {item.serialNumber && (
                            <Text style={styles.attribute}>SN: {item.serialNumber}</Text>
                        )}
                    </View>
                );

            case 'Accessories':
                return (
                    <View style={styles.attributesContainer}>
                        {item.brand && (
                            <Text style={styles.attribute}>Brand: {item.brand}</Text>
                        )}
                        {item.material && (
                            <Text style={styles.attribute}>Material: {item.material}</Text>
                        )}
                        {item.color && (
                            <Text style={styles.attribute}>Color: {item.color}</Text>
                        )}
                    </View>
                );

            case 'Clothing':
                return (
                    <View style={styles.attributesContainer}>
                        {item.brand && (
                            <Text style={styles.attribute}>Brand: {item.brand}</Text>
                        )}
                        {item.size && (
                            <Text style={styles.attribute}>Size: {item.size}</Text>
                        )}
                        {item.color && (
                            <Text style={styles.attribute}>Color: {item.color}</Text>
                        )}
                        {item.material && (
                            <Text style={styles.attribute}>Material: {item.material}</Text>
                        )}
                    </View>
                );

            case 'Documents':
                return (
                    <View style={styles.attributesContainer}>
                        {item.documentType && (
                            <Text style={styles.attribute}>Type: {item.documentType}</Text>
                        )}
                        {item.issuingAuthority && (
                            <Text style={styles.attribute}>Issuer: {item.issuingAuthority}</Text>
                        )}
                        {item.nameOnDocument && (
                            <Text style={styles.attribute}>Name: {item.nameOnDocument}</Text>
                        )}
                    </View>
                );

            default:
                return (
                    <View style={styles.attributesContainer}>
                        {item.color && (
                            <Text style={styles.attribute}>Color: {item.color}</Text>
                        )}
                        {item.brand && (
                            <Text style={styles.attribute}>Brand: {item.brand}</Text>
                        )}
                    </View>
                );
        }
    };
    
    // Helper function to highlight matching attributes
    const getMatchingAttributes = (lostItem, foundItem, matchDetails) => {
        if (!lostItem || !foundItem) return [];
        
        const matches = [];
        const category = lostItem.category || 'Others';
        
        // Check for matchDetails from the backend
        if (matchDetails && typeof matchDetails === 'object') {
            const categorySpecificDetails = matchDetails.categorySpecificAttributes || {};
            
            // Process the details and create readable match attributes
            Object.entries(categorySpecificDetails).forEach(([key, score]) => {
                if (score > 0) {
                    const value = lostItem[key] || foundItem[key];
                    if (value) {
                        matches.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${value} (${score}%)`);
                    }
                }
            });
            
            // If no category-specific attributes matched but we have other similarity scores
            if (matches.length === 0) {
                if (matchDetails.descriptionSimilarity > 0) {
                    matches.push(`Description similarity: ${matchDetails.descriptionSimilarity}%`);
                }
                if (matchDetails.locationSimilarity > 0) {
                    matches.push(`Location similarity: ${matchDetails.locationSimilarity}%`);
                }
            }
            
            return matches;
        }
        
        // Fallback to client-side matching if no match details from backend
        // Generic attributes check
        if (lostItem.color && foundItem.color && 
            lostItem.color.toLowerCase() === foundItem.color.toLowerCase()) {
            matches.push(`Color: ${lostItem.color}`);
        }
        
        if (lostItem.brand && foundItem.brand && 
            lostItem.brand.toLowerCase() === foundItem.brand.toLowerCase()) {
            matches.push(`Brand: ${lostItem.brand}`);
        }
        
        // Category-specific attributes
        switch (category) {
            case 'Electronics':
                if (lostItem.model && foundItem.model && 
                    lostItem.model.toLowerCase() === foundItem.model.toLowerCase()) {
                    matches.push(`Model: ${lostItem.model}`);
                }
                
                if (lostItem.serialNumber && foundItem.serialNumber && 
                    lostItem.serialNumber === foundItem.serialNumber) {
                    const serialPreview = lostItem.serialNumber.length > 4 
                        ? lostItem.serialNumber.substring(0, 4) + '...' 
                        : lostItem.serialNumber;
                    matches.push(`Serial Number: ${serialPreview}`);
                }
                break;
                
            case 'Accessories':
                if (lostItem.material && foundItem.material && 
                    lostItem.material.toLowerCase() === foundItem.material.toLowerCase()) {
                    matches.push(`Material: ${lostItem.material}`);
                }
                break;
                
            case 'Clothing':
                if (lostItem.size && foundItem.size && 
                    lostItem.size.toLowerCase() === foundItem.size.toLowerCase()) {
                    matches.push(`Size: ${lostItem.size}`);
                }
                
                if (lostItem.material && foundItem.material && 
                    lostItem.material.toLowerCase() === foundItem.material.toLowerCase()) {
                    matches.push(`Material: ${lostItem.material}`);
                }
                break;
                
            case 'Documents':
                if (lostItem.documentType && foundItem.documentType && 
                    lostItem.documentType.toLowerCase() === foundItem.documentType.toLowerCase()) {
                    matches.push(`Document Type: ${lostItem.documentType}`);
                }
                
                if (lostItem.issuingAuthority && foundItem.issuingAuthority && 
                    lostItem.issuingAuthority.toLowerCase() === foundItem.issuingAuthority.toLowerCase()) {
                    matches.push(`Issuer: ${lostItem.issuingAuthority}`);
                }
                
                if (lostItem.nameOnDocument && foundItem.nameOnDocument) {
                    matches.push(`Name on Document: ${lostItem.nameOnDocument}`);
                }
                break;
        }
        
        return matches;
    };
    
    // Add this function right before the return statement in the component
    const checkForDuplicates = (matchesArray) => {
        if (!matchesArray || matchesArray.length === 0) return matchesArray;
        
        // Track item pairs to detect duplicates
        const seenPairs = new Map();
        const duplicates = [];
        
        matchesArray.forEach((match, index) => {
            if (match.lostItem && match.foundItem) {
                // New structure
                const lostId = match.lostItem._id || match.lostItem.id;
                const foundId = match.foundItem._id || match.foundItem.id;
                
                if (lostId && foundId) {
                    // Create a consistent pair key regardless of order
                    const smallerId = String(lostId) < String(foundId) ? lostId : foundId;
                    const largerId = String(lostId) > String(foundId) ? lostId : foundId;
                    const pairKey = `${smallerId}_${largerId}`;
                    
                    if (seenPairs.has(pairKey)) {
                        // Found a duplicate!
                        console.warn(`Duplicate match found at index ${index} with pair key ${pairKey}`);
                        duplicates.push(index);
                    } else {
                        seenPairs.set(pairKey, index);
                    }
                }
            } else if (match.lostItemId && match.foundItemId) {
                // Old structure
                const lostId = match.lostItemId;
                const foundId = match.foundItemId;
                
                // Create a consistent pair key regardless of order
                const smallerId = String(lostId) < String(foundId) ? lostId : foundId;
                const largerId = String(lostId) > String(foundId) ? lostId : foundId;
                const pairKey = `${smallerId}_${largerId}`;
                
                if (seenPairs.has(pairKey)) {
                    // Found a duplicate!
                    console.warn(`Duplicate match found at index ${index} with pair key ${pairKey}`);
                    duplicates.push(index);
                } else {
                    seenPairs.set(pairKey, index);
                }
            }
        });
        
        if (duplicates.length > 0) {
            console.warn(`Found ${duplicates.length} duplicates in matches array`);
        } else {
            console.log('No duplicates found in matches array');
        }
        
        return matchesArray;
    };

    // Add this line right before the return statement
    const checkedMatches = checkForDuplicates(matches);
    
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Matches</Text>
                <View style={{ width: 40 }} />
            </View>
            
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.totalMatches}</Text>
                    <Text style={styles.statLabel}>Total Matches</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.pendingMatches}</Text>
                    <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.confirmedMatches}</Text>
                    <Text style={styles.statLabel}>Confirmed</Text>
                </View>
            </View>
            
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3d0c45" />
                    <Text style={styles.loadingText}>Loading matches...</Text>
                </View>
            ) : checkedMatches.length > 0 ? (
                <FlatList
                    data={checkedMatches}
                    renderItem={renderMatchItem}
                    keyExtractor={item => item._id || item.id || `match_${Math.random().toString(36).substring(2, 9)}`}
                    contentContainerStyle={styles.matchesList}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <Ionicons name="search" size={64} color="#ccc" />
                    <Text style={styles.emptyTitle}>No Matches Found</Text>
                    <Text style={styles.emptyText}>
                        We haven't found any matches for your items yet. 
                        We'll notify you when we find a potential match.
                    </Text>
                </View>
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
        justifyContent: 'space-between',
        backgroundColor: '#3d0c45',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e1e1e1',
    },
    statCard: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    statLabel: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
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
    matchesList: {
        padding: 16,
    },
    matchItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    matchType: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    matchScore: {
        fontSize: 14,
        color: '#4CAF50',
        fontWeight: '600',
    },
    matchContent: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 12,
    },
    itemDetails: {
        flex: 1,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    itemCategory: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    itemDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    itemLocation: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    itemDate: {
        fontSize: 14,
        color: '#666',
    },
    matchFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        marginRight: 12,
    },
    userName: {
        fontSize: 14,
        color: '#333',
    },
    chatButton: {
        backgroundColor: '#3d0c45',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    chatButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    attributesContainer: {
        marginVertical: 8,
        padding: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    attribute: {
        fontSize: 12,
        color: '#555',
        marginBottom: 3,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
    debugInfo: {
        fontSize: width * 0.03,
        color: '#888',
        marginTop: 5,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    errorMatchItem: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        color: '#333',
        fontWeight: 'bold',
    },
    userDetails: {
        flexDirection: 'column',
    },
    matchStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    matchDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    itemDetail: {
        flex: 1,
    },
    itemLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
    },
    itemMeta: {
        fontSize: 14,
        color: '#666',
    },
    matchConfidence: {
        fontSize: 12,
        color: '#666',
    },
    matchingAttributesContainer: {
        marginVertical: 8,
        padding: 8,
        backgroundColor: '#e8f5e9',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#c8e6c9',
    },
    matchingAttributesTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#2e7d32',
        marginBottom: 5,
    },
    matchingAttribute: {
        fontSize: 12,
        color: '#1b5e20',
        marginBottom: 3,
        paddingLeft: 5,
    },
});

export default MatchesScreen; 