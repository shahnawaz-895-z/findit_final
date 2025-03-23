import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    ActivityIndicator,
    Alert,
    Dimensions,
    RefreshControl
} from 'react-native';
import axios from 'axios';
import API_CONFIG from '../config';

const { width, height } = Dimensions.get('window');

export default function PotentialMatchesScreen({ route, navigation }) {
    const { itemId, itemType } = route.params;
    const [matches, setMatches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPotentialMatches = useCallback(async () => {
        try {
            setError(null);
            
            if (!itemId || !itemType) {
                setError('Missing required item information');
                return;
            }
            
            const response = await axios.get(
                `${API_CONFIG.API_URL}/api/matches/${itemId}/${itemType}`,
                { 
                    timeout: 8000,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            
            if (response.data.status === 'success') {
                if (Array.isArray(response.data.data.matches)) {
                    setMatches(response.data.data.matches);
                } else {
                    console.warn('Invalid matches data format:', response.data);
                    setMatches([]);
                }
            } else {
                throw new Error(response.data.message || 'Failed to fetch matches');
            }
        } catch (error) {
            console.error('Error fetching potential matches:', error);
            
            if (error.response) {
                setError(error.response.data?.message || 'Server error. Please try again.');
            } else if (error.request) {
                setError('Network error. Please check your connection.');
            } else {
                setError('Unable to load potential matches. Please try again.');
            }
            
            if (!refreshing) {
                Alert.alert('Error', 'Failed to load potential matches');
            }
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [itemId, itemType, refreshing]);

    useEffect(() => {
        setIsLoading(true);
        fetchPotentialMatches();
    }, [fetchPotentialMatches]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPotentialMatches();
    }, [fetchPotentialMatches]);

    const confirmMatch = async (matchId) => {
        if (!matchId) {
            Alert.alert('Error', 'Invalid match information');
            return;
        }
        
        try {
            setIsLoading(true);
            
            const response = await axios.post(
                `${API_CONFIG.API_URL}/api/confirm-match/${matchId}`,
                { status: 'confirmed' },
                { 
                    timeout: 8000,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            
            if (response.data.status === 'success') {
                Alert.alert('Success', 'Match confirmed successfully!');
                fetchPotentialMatches(); // Refresh the list
            } else {
                throw new Error(response.data.message || 'Failed to confirm match');
            }
        } catch (error) {
            console.error('Error confirming match:', error);
            
            const errorMsg = error.response?.data?.message || 'Failed to confirm match';
            Alert.alert('Error', errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const viewItemDetails = (item) => {
        if (!item || !item._id) {
            Alert.alert('Error', 'Invalid item data');
            return;
        }
        
        navigation.navigate('ItemDetails', {
            item,
            itemType: itemType === 'lost' ? 'found' : 'lost'
        });
    };

    // Determine which item to display based on the current item type
    const getMatchedItem = (match) => {
        if (!match) return null;
        return itemType === 'lost' ? match.foundItemId : match.lostItemId;
    };

    const renderMatchItem = ({ item: match }) => {
        const matchedItem = getMatchedItem(match);
        if (!matchedItem) return null;
        
        return (
            <TouchableOpacity 
                style={styles.matchCard}
                onPress={() => viewItemDetails(matchedItem)}
            >
                <View style={styles.matchHeader}>
                    <Text style={styles.matchTitle}>
                        {matchedItem.itemName || `${matchedItem.category || 'Unknown'} Item`}
                    </Text>
                    <Text style={[
                        styles.matchScore,
                        { 
                            color: getMatchScoreColor(match.similarityScore || 0)
                        }
                    ]}>
                        {((match.similarityScore || 0) * 100).toFixed(1)}% Match
                    </Text>
                </View>
                
                <Text style={styles.matchDetail}>
                    <Text style={styles.matchLabel}>Category: </Text>
                    {matchedItem.category || 'N/A'}
                </Text>
                
                <Text style={styles.matchDetail}>
                    <Text style={styles.matchLabel}>Location: </Text>
                    {matchedItem.location || 'N/A'}
                </Text>
                
                <Text style={styles.matchDetail}>
                    <Text style={styles.matchLabel}>Date: </Text>
                    {matchedItem.date ? new Date(matchedItem.date).toLocaleDateString() : 'N/A'}
                </Text>
                
                <Text style={styles.matchDescription} numberOfLines={3}>
                    {matchedItem.description || 'No description available'}
                </Text>
                
                <TouchableOpacity 
                    style={styles.confirmButton}
                    onPress={() => confirmMatch(match._id)}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.confirmButtonText}>Confirm Match</Text>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const getMatchScoreColor = (score) => {
        if (score >= 0.7) return '#28a745';  // Green for high match
        if (score >= 0.4) return '#ffc107';  // Yellow for moderate match
        return '#dc3545';  // Red for low match
    };

    if (isLoading && !refreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3d0c45" />
                <Text style={styles.loadingText}>Finding potential matches...</Text>
            </View>
        );
    }

    if (error && !refreshing) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => {
                        setIsLoading(true);
                        fetchPotentialMatches();
                    }}
                >
                    <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerText}>
                Potential Matches ({matches.length})
            </Text>
            
            {matches.length === 0 ? (
                <View style={styles.noMatchesContainer}>
                    <Text style={styles.noMatchesText}>
                        No potential matches found yet.
                    </Text>
                    <Text style={styles.noMatchesSubtext}>
                        Check back later as more items are reported.
                    </Text>
                    <TouchableOpacity 
                        style={styles.refreshButton}
                        onPress={onRefresh}
                    >
                        <Text style={styles.refreshButtonText}>Refresh</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={matches}
                    keyExtractor={(item) => item._id || Math.random().toString()}
                    renderItem={renderMatchItem}
                    contentContainerStyle={styles.matchesList}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#3d0c45']}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.noMatchesContainer}>
                            <Text style={styles.noMatchesText}>
                                No matches available.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: width * 0.05,
        backgroundColor: '#f8f9fa',
    },
    headerText: {
        fontSize: width * 0.07,
        fontWeight: 'bold',
        color: '#3d0c45',
        marginBottom: height * 0.02,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: width * 0.05,
    },
    loadingText: {
        fontSize: width * 0.04,
        color: '#3d0c45',
        marginTop: height * 0.02,
    },
    errorText: {
        fontSize: width * 0.04,
        color: '#d9534f',
        textAlign: 'center',
        marginBottom: height * 0.02,
    },
    retryButton: {
        backgroundColor: '#3d0c45',
        paddingVertical: height * 0.015,
        paddingHorizontal: width * 0.08,
        borderRadius: width * 0.02,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: width * 0.04,
        fontWeight: 'bold',
    },
    refreshButton: {
        backgroundColor: '#3d0c45',
        paddingVertical: height * 0.015,
        paddingHorizontal: width * 0.08,
        borderRadius: width * 0.02,
        marginTop: height * 0.02,
    },
    refreshButtonText: {
        color: '#fff',
        fontSize: width * 0.04,
        fontWeight: 'bold',
    },
    noMatchesContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noMatchesText: {
        fontSize: width * 0.05,
        fontWeight: 'bold',
        color: '#3d0c45',
        textAlign: 'center',
    },
    noMatchesSubtext: {
        fontSize: width * 0.04,
        color: '#666',
        textAlign: 'center',
        marginTop: height * 0.01,
    },
    matchesList: {
        paddingBottom: height * 0.02,
    },
    matchCard: {
        backgroundColor: '#fff',
        borderRadius: width * 0.03,
        padding: width * 0.04,
        marginBottom: height * 0.02,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: height * 0.01,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: height * 0.01,
    },
    matchTitle: {
        fontSize: width * 0.045,
        fontWeight: 'bold',
        color: '#3d0c45',
        flex: 1,
    },
    matchScore: {
        fontSize: width * 0.04,
        fontWeight: 'bold',
    },
    matchDetail: {
        fontSize: width * 0.035,
        color: '#333',
        marginVertical: height * 0.003,
    },
    matchLabel: {
        fontWeight: 'bold',
        color: '#666',
    },
    matchDescription: {
        fontSize: width * 0.035,
        color: '#666',
        marginTop: height * 0.01,
        marginBottom: height * 0.02,
    },
    confirmButton: {
        backgroundColor: '#28a745',
        paddingVertical: height * 0.01,
        borderRadius: width * 0.02,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: width * 0.035,
    }
});