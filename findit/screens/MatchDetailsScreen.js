import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Image,
    Platform,
    StatusBar,
    SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';

// Get the status bar height for proper padding
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const MatchDetailsScreen = ({ route, navigation }) => {
    const { matchId } = route.params;
    const [match, setMatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Custom StatusBar component to ensure visibility
    const CustomStatusBar = ({backgroundColor, ...props}) => (
        <View style={[styles.statusBar, { backgroundColor }]}>
            <StatusBar translucent backgroundColor={backgroundColor} {...props} />
        </View>
    );

    // Fetch match details when the screen loads
    useEffect(() => {
        fetchMatchDetails();
    }, []);

    const fetchMatchDetails = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('authToken');
            
            const response = await fetch(`${API_CONFIG.API_URL}/match/${matchId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('Match details received:', data.match);
                setMatch(data.match);
            } else {
                setError(data.message || 'Failed to fetch match details');
            }
        } catch (error) {
            console.error('Error fetching match details:', error);
            setError('Failed to fetch match details');
        } finally {
            setLoading(false);
        }
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

    const handleUpdateStatus = async (newStatus) => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('authToken');
            const response = await fetch(`${API_CONFIG.API_URL}/update-match-status/${matchId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await response.json();
            if (data.status === 'success') {
                Alert.alert('Success', 'Match status updated successfully');
                // Refresh match details after update
                fetchMatchDetails();
            } else {
                Alert.alert('Error', data.message || 'Failed to update match status');
            }
        } catch (error) {
            console.error('Error updating match status:', error);
            Alert.alert('Error', 'Failed to update match status');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return 'Unknown date';
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <CustomStatusBar backgroundColor="#3d0c45" barStyle="light-content" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3d0c45" />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !match) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <CustomStatusBar backgroundColor="#3d0c45" barStyle="light-content" />
                <View style={styles.errorContainer}>
                    <Icon name="alert-circle-outline" size={64} color="#dc3545" />
                    <Text style={styles.errorText}>{error || 'Match not found'}</Text>
                    <TouchableOpacity
                        style={styles.buttonContainer}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.buttonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <CustomStatusBar backgroundColor="#3d0c45" barStyle="light-content" />
            <View style={styles.headerBar}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Match Details</Text>
                <View style={{width: 40}} />
            </View>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.titleContainer}>
                        <Icon 
                            name="target" 
                            size={24} 
                            color="#3d0c45" 
                        />
                        <Text style={styles.title}>Potential Match</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(match.status || 'pending').bg }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(match.status || 'pending').text }]}>
                            {(match.status || 'pending').charAt(0).toUpperCase() + (match.status || 'pending').slice(1)}
                        </Text>
                    </View>
                </View>

                {/* Lost Item Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="help-circle-outline" size={24} color="#3d0c45" />
                        <Text style={styles.sectionTitle}>Lost Item</Text>
                    </View>
                    
                    {match.lostItemId && (
                        <>
                            <Text style={styles.itemName}>{match.lostItemId.itemName || 'Unnamed Item'}</Text>
                            
                            {match.lostItemId.photo && (
                                <View style={styles.imageContainer}>
                                    <Image 
                                        source={{ uri: `data:image/jpeg;base64,${match.lostItemId.photo}` }}
                                        style={styles.itemImage}
                                        resizeMode="cover"
                                    />
                                </View>
                            )}
                            
                            <View style={styles.detailsContainer}>
                                <View style={styles.infoRow}>
                                    <Icon name="map-marker-outline" size={20} color="#555" />
                                    <Text style={styles.infoLabel}>Location:</Text>
                                    <Text style={styles.infoText}>{match.lostItemId.location}</Text>
                                </View>
                                
                                <View style={styles.infoRow}>
                                    <Icon name="calendar-outline" size={20} color="#555" />
                                    <Text style={styles.infoLabel}>Date:</Text>
                                    <Text style={styles.infoText}>{formatDate(match.lostItemId.date)}</Text>
                                </View>
                                
                                <View style={styles.infoRow}>
                                    <Icon name="tag-outline" size={20} color="#555" />
                                    <Text style={styles.infoLabel}>Category:</Text>
                                    <Text style={styles.infoText}>{match.lostItemId.category}</Text>
                                </View>
                                
                                <View style={styles.descriptionContainer}>
                                    <Text style={styles.descriptionLabel}>Description:</Text>
                                    <Text style={styles.descriptionText}>{match.lostItemId.description}</Text>
                                </View>
                            </View>
                            
                            <TouchableOpacity 
                                style={styles.viewButtonContainer}
                                onPress={() => navigation.navigate('ItemDetails', { 
                                    itemId: match.lostItemId._id,
                                    itemType: 'lost'
                                })}
                            >
                                <Text style={styles.viewButtonText}>View Lost Item Details</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Found Item Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="checkbox-marked-circle-outline" size={24} color="#3d0c45" />
                        <Text style={styles.sectionTitle}>Found Item</Text>
                    </View>
                    
                    {match.foundItemId && (
                        <>
                            <Text style={styles.itemName}>{match.foundItemId.itemName || 'Unnamed Item'}</Text>
                            
                            {match.foundItemId.photo && (
                                <View style={styles.imageContainer}>
                                    <Image 
                                        source={{ uri: `data:image/jpeg;base64,${match.foundItemId.photo}` }}
                                        style={styles.itemImage}
                                        resizeMode="cover"
                                    />
                                </View>
                            )}
                            
                            <View style={styles.detailsContainer}>
                                <View style={styles.infoRow}>
                                    <Icon name="map-marker-outline" size={20} color="#555" />
                                    <Text style={styles.infoLabel}>Location:</Text>
                                    <Text style={styles.infoText}>{match.foundItemId.location}</Text>
                                </View>
                                
                                <View style={styles.infoRow}>
                                    <Icon name="calendar-outline" size={20} color="#555" />
                                    <Text style={styles.infoLabel}>Date:</Text>
                                    <Text style={styles.infoText}>{formatDate(match.foundItemId.date)}</Text>
                                </View>
                                
                                <View style={styles.infoRow}>
                                    <Icon name="tag-outline" size={20} color="#555" />
                                    <Text style={styles.infoLabel}>Category:</Text>
                                    <Text style={styles.infoText}>{match.foundItemId.category}</Text>
                                </View>
                                
                                <View style={styles.descriptionContainer}>
                                    <Text style={styles.descriptionLabel}>Description:</Text>
                                    <Text style={styles.descriptionText}>{match.foundItemId.description}</Text>
                                </View>
                            </View>
                            
                            <TouchableOpacity 
                                style={styles.viewButtonContainer}
                                onPress={() => navigation.navigate('ItemDetails', { 
                                    itemId: match.foundItemId._id,
                                    itemType: 'found'
                                })}
                            >
                                <Text style={styles.viewButtonText}>View Found Item Details</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Match Information */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Icon name="file-document-outline" size={24} color="#3d0c45" />
                        <Text style={styles.sectionTitle}>Match Information</Text>
                    </View>
                    
                    <View style={styles.matchScoreContainer}>
                        <Text style={styles.matchScoreLabel}>Match Confidence:</Text>
                        <View style={styles.scoreBar}>
                            <View 
                                style={[
                                    styles.scoreBarFill, 
                                    { width: `${Math.round((match.similarityScore || 0.5) * 100)}%` }
                                ]} 
                            />
                        </View>
                        <Text style={styles.scorePercentage}>{Math.round((match.similarityScore || 0.5) * 100)}%</Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                        <Icon name="calendar-check" size={20} color="#555" />
                        <Text style={styles.infoLabel}>Match Date:</Text>
                        <Text style={styles.infoText}>{formatDate(match.createdAt)}</Text>
                    </View>
                </View>

                {/* Action Buttons */}
                {(match.status === 'pending' || !match.status) && (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity 
                            style={[styles.button, styles.confirmButton]}
                            onPress={() => handleUpdateStatus('matched')}
                        >
                            <Text style={styles.buttonText}>Confirm Match</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.button, styles.declineButton]}
                            onPress={() => handleUpdateStatus('declined')}
                        >
                            <Text style={[styles.buttonText, styles.declineButtonText]}>Decline Match</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {match.status === 'matched' && (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity 
                            style={[styles.button, styles.confirmButton]}
                            onPress={() => handleUpdateStatus('returned')}
                        >
                            <Text style={styles.buttonText}>Mark as Returned</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#3d0c45',
    },
    statusBar: {
        height: STATUSBAR_HEIGHT,
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#3d0c45',
        paddingVertical: 16,
        paddingHorizontal: 16,
        paddingTop: STATUSBAR_HEIGHT + 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    backButton: {
        padding: 8,
    },
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: '#6c757d',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 20,
    },
    header: {
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 10,
        color: '#3d0c45',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '500',
    },
    section: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
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
    itemName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    imageContainer: {
        width: '100%',
        height: 200,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderRadius: 8,
        overflow: 'hidden',
    },
    itemImage: {
        width: '100%',
        height: '100%',
    },
    detailsContainer: {
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        marginLeft: 8,
        width: 80,
    },
    infoText: {
        fontSize: 14,
        color: '#555',
        flex: 1,
    },
    descriptionContainer: {
        marginTop: 8,
    },
    descriptionLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        marginBottom: 4,
    },
    descriptionText: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
    },
    matchScoreContainer: {
        marginBottom: 16,
    },
    matchScoreLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333',
        marginBottom: 8,
    },
    scoreBar: {
        height: 16,
        backgroundColor: '#e9ecef',
        borderRadius: 8,
        marginBottom: 4,
    },
    scoreBarFill: {
        height: '100%',
        backgroundColor: '#3d0c45',
        borderRadius: 8,
    },
    scorePercentage: {
        fontSize: 14,
        fontWeight: '500',
        color: '#3d0c45',
        textAlign: 'right',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
    },
    confirmButton: {
        backgroundColor: '#3d0c45',
        marginRight: 8,
    },
    declineButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#dc3545',
        marginLeft: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    declineButtonText: {
        color: '#dc3545',
    },
    viewButtonContainer: {
        backgroundColor: '#3d0c45',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    viewButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    buttonContainer: {
        backgroundColor: '#3d0c45',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        margin: 16,
        width: '80%',
    },
});

export default MatchDetailsScreen;