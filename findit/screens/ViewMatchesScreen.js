import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';

const ViewMatchesScreen = ({ navigation }) => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('all'); // all, pending, matched, returned

    const fetchMatches = async () => {
        try {
            const token = await AsyncStorage.getItem('authToken');
            if (!token) {
                console.log('No authentication token found');
                throw new Error('No authentication token found');
            }
            
            console.log('Fetching matches with token:', token.substring(0, 10) + '...');
            const userData = await AsyncStorage.getItem('userData');
            console.log('Current user:', userData ? JSON.parse(userData)._id : 'unknown');

            const response = await fetch(`${API_CONFIG.API_URL}/user-matches`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error response:', errorData);
                throw new Error(errorData.message || 'Failed to fetch matches');
            }

            const data = await response.json();
            console.log('Matches data received:', JSON.stringify(data));
            
            if (data.status === 'success') {
                console.log(`Received ${data.matches.length} matches`);
                setMatches(data.matches);
            } else {
                console.error('Unexpected response format:', data);
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching matches:', error);
            Alert.alert('Error', 'Failed to fetch matches. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMatches();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchMatches();
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'pending': return { bg: '#fff3cd', text: '#856404' };
            case 'matched': return { bg: '#d1e7dd', text: '#155724' };
            case 'returned': return { bg: '#cce5ff', text: '#004085' };
            case 'claimed': return { bg: '#d4edda', text: '#155724' };
            case 'unclaimed': return { bg: '#f8d7da', text: '#721c24' };
            default: return { bg: '#e2e3e5', text: '#383d41' };
        }
    };

    const getStatusIcon = (status) => {
        switch(status) {
            case 'pending': return 'time-outline';
            case 'matched': return 'checkmark-circle-outline';
            case 'returned': return 'checkmark-done-circle-outline';
            case 'claimed': return 'person-check-outline';
            case 'unclaimed': return 'person-remove-outline';
            default: return 'information-circle-outline';
        }
    };

    const filteredMatches = matches.filter(match => {
        if (selectedFilter === 'all') return true;
        return match.status === selectedFilter;
    });

    const renderMatchItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.matchCard}
            onPress={() => navigation.navigate('MatchDetailsScreen', { match: item })}
        >
            <View style={styles.matchHeader}>
                <View style={styles.matchTypeContainer}>
                    <Icon 
                        name={item.type === 'lost' ? 'search-outline' : 'checkmark-circle-outline'} 
                        size={24} 
                        color="#3d0c45" 
                    />
                    <Text style={styles.matchType}>
                        {item.type === 'lost' ? 'Lost Item' : 'Found Item'}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status).bg }]}>
                    <Icon 
                        name={getStatusIcon(item.status)} 
                        size={16} 
                        color={getStatusColor(item.status).text} 
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status).text }]}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                </View>
            </View>

            <View style={styles.matchContent}>
                <Text style={styles.itemName}>{item.itemName}</Text>
                <Text style={styles.description} numberOfLines={2}>
                    {item.description}
                </Text>
                
                <View style={styles.matchDetails}>
                    <View style={styles.detailRow}>
                        <Icon name="location-outline" size={16} color="#666" />
                        <Text style={styles.detailText}>{item.location}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Icon name="calendar-outline" size={16} color="#666" />
                        <Text style={styles.detailText}>
                            {new Date(item.date).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                <View style={styles.matchScore}>
                    <View style={styles.scoreBar}>
                        <View 
                            style={[
                                styles.scoreFill, 
                                { width: `${item.matchConfidence}%` }
                            ]} 
                        />
                    </View>
                    <Text style={styles.scoreText}>
                        {item.matchConfidence}% Match
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderFilterButtons = () => (
        <View style={styles.filterContainer}>
            {['all', 'pending', 'matched', 'returned'].map((filter) => (
                <TouchableOpacity
                    key={filter}
                    style={[
                        styles.filterButton,
                        selectedFilter === filter && styles.filterButtonActive
                    ]}
                    onPress={() => setSelectedFilter(filter)}
                >
                    <Text style={[
                        styles.filterText,
                        selectedFilter === filter && styles.filterTextActive
                    ]}>
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color="#3d0c45" />
                <Text style={styles.loadingText}>Loading matches...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {renderFilterButtons()}
            <FlatList
                data={filteredMatches}
                renderItem={renderMatchItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#3d0c45']}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="search-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No matches found</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    filterContainer: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    filterButton: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
        backgroundColor: '#f5f5f5',
    },
    filterButtonActive: {
        backgroundColor: '#3d0c45',
    },
    filterText: {
        color: '#666',
        fontSize: 14,
    },
    filterTextActive: {
        color: '#fff',
    },
    listContainer: {
        padding: 15,
    },
    matchCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
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
        marginBottom: 10,
    },
    matchTypeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    matchType: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#3d0c45',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    statusText: {
        marginLeft: 5,
        fontSize: 12,
        fontWeight: '500',
    },
    matchContent: {
        marginTop: 10,
    },
    itemName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    description: {
        fontSize: 14,
        color: '#666',
        marginBottom: 10,
    },
    matchDetails: {
        marginTop: 10,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    detailText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#666',
    },
    matchScore: {
        marginTop: 15,
    },
    scoreBar: {
        height: 6,
        backgroundColor: '#f0f0f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    scoreFill: {
        height: '100%',
        backgroundColor: '#3d0c45',
        borderRadius: 3,
    },
    scoreText: {
        marginTop: 5,
        fontSize: 12,
        color: '#666',
        textAlign: 'right',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
});

export default ViewMatchesScreen; 