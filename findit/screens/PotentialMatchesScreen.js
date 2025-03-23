import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    TouchableOpacity, 
    ActivityIndicator,
    Alert,
    Dimensions 
} from 'react-native';
import axios from 'axios';
import API_CONFIG from '../config';

const { width, height } = Dimensions.get('window');

export default function PotentialMatchesScreen({ route, navigation }) {
    const { itemId, itemType } = route.params;
    const [matches, setMatches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchPotentialMatches();
    }, [itemId, itemType]);

    const fetchPotentialMatches = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            const response = await axios.get(
                `${API_CONFIG.API_URL}/api/matches/${itemId}/${itemType}`,
                { timeout: 10000 }
            );
            
            if (response.data.status === 'success') {
                setMatches(response.data.data.matches);
            } else {
                throw new Error('Failed to fetch matches');
            }
        } catch (error) {
            console.error('Error fetching potential matches:', error);
            setError('Unable to load potential matches. Please try again.');
            Alert.alert('Error', 'Failed to load potential matches');
        } finally {
            setIsLoading(false);
        }
    };

    const confirmMatch = async (matchId) => {
        try {
            setIsLoading(true);
            
            const response = await axios.post(
                `${API_CONFIG.API_URL}/api/confirm-match/${matchId}`,
                { status: 'confirmed' }
            );
            
            if (response.data.status === 'success') {
                Alert.alert('Success', 'Match confirmed successfully!');
                fetchPotentialMatches(); // Refresh the list
            } else {
                throw new Error('Failed to confirm match');
            }
        } catch (error) {
            console.error('Error confirming match:', error);
            Alert.alert('Error', 'Failed to confirm match');
        } finally {
            setIsLoading(false);
        }
    };

    const viewItemDetails = (item) => {
        navigation.navigate('ItemDetails', {
            item,
            itemType: itemType === 'lost' ? 'found' : 'lost'
        });
    };

    // Determine which item to display based on the current item type
    const getMatchedItem = (match) => {
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
                        {matchedItem.itemName || `${matchedItem.category} Item`}
                    </Text>
                    <Text style={styles.matchScore}>
                        {(match.similarityScore * 100).toFixed(1)}% Match
                    </Text>
                </View>
                
                <Text style={styles.matchDetail}>
                    <Text style={styles.matchLabel}>Category: </Text>
                    {matchedItem.category}
                </Text>
                
                <Text style={styles.matchDetail}>
                    <Text style={styles.matchLabel}>Location: </Text>
                    {matchedItem.location}
                </Text>
                
                <Text style={styles.matchDetail}>
                    <Text style={styles.matchLabel}>Date: </Text>
                    {new Date(matchedItem.date).toLocaleDateString()}
                </Text>
                
                <Text style={styles.matchDescription} numberOfLines={3}>
                    {matchedItem.description}
                </Text>
                
                <TouchableOpacity 
                    style={styles.confirmButton}
                    onPress={() => confirmMatch(match._id)}
                >
                    <Text style={styles.confirmButtonText}>Confirm Match</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3d0c45" />
                <Text style={styles.loadingText}>Finding potential matches...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={fetchPotentialMatches}
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
                </View>
            ) : (
                <FlatList
                    data={matches}
                    keyExtractor={(item) => item._id}
                    renderItem={renderMatchItem}
                    contentContainerStyle={styles.matchesList}
                    showsVerticalScrollIndicator={false}
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
    },
    matchTitle: {
        fontSize: width * 0.045,
        fontWeight: 'bold',
        color: '#3d0c45',
        flex: 1,
    },
    matchScore: {
        fontSize: width * 0.035,
        fontWeight: 'bold',
        color: '#fff',
        backgroundColor: '#3d0c45',
        paddingHorizontal: width * 0.02,
        paddingVertical: height * 0.005,
        borderRadius: width * 0.015,
    },
    matchDetail: {
        fontSize: width * 0.035,
        color: '#333',
        marginBottom: height * 0.005,
    },
    matchLabel: {
        fontWeight: 'bold',
        color: '#3d0c45',
    },
    matchDescription: {
        fontSize: width * 0.035,
        color: '#666',
        marginVertical: height * 0.01,
    },
    confirmButton: {
        backgroundColor: '#28a745',
        borderRadius: width * 0.02,
        paddingVertical: height * 0.01,
        alignItems: 'center',
        marginTop: height * 0.01,
    },
    confirmButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: width * 0.035,
    },
});