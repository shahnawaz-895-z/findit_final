import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';

const MatchDetailsScreen = ({ route, navigation }) => {
    const { match } = route.params;
    const [loading, setLoading] = useState(false);

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
            const response = await fetch(`${API_CONFIG.API_URL}/update-match-status/${match._id}`, {
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
                navigation.goBack();
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
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3d0c45" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleContainer}>
                    <Icon 
                        name={match.type === 'lost' ? 'search-outline' : 'checkmark-circle-outline'} 
                        size={24} 
                        color="#3d0c45" 
                    />
                    <Text style={styles.title}>{match.type === 'lost' ? 'Lost Item' : 'Found Item'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(match.status).bg }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(match.status).text }]}>
                        {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                    </Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Item Details</Text>
                <Text style={styles.itemName}>{match.itemName}</Text>
                <Text style={styles.description}>{match.description}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Match Information</Text>
                <View style={styles.infoRow}>
                    <Icon name="location-outline" size={20} color="#666" />
                    <Text style={styles.infoText}>{match.location}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Icon name="calendar-outline" size={20} color="#666" />
                    <Text style={styles.infoText}>{formatDate(match.date)}</Text>
                </View>
                <View style={styles.matchScore}>
                    <Text style={styles.matchScoreText}>Match Confidence</Text>
                    <View style={styles.scoreBar}>
                        <View style={[styles.scoreFill, { width: `${match.matchConfidence || 60}%` }]} />
                    </View>
                    <Text style={styles.scorePercentage}>{match.matchConfidence || 60}%</Text>
                </View>
            </View>

            {match.status === 'pending' && (
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
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    itemName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        color: '#666',
        lineHeight: 24,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 16,
        color: '#666',
        marginLeft: 10,
    },
    matchScore: {
        marginTop: 15,
    },
    matchScoreText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    scoreBar: {
        height: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    scoreFill: {
        height: '100%',
        backgroundColor: '#3d0c45',
        borderRadius: 4,
    },
    scorePercentage: {
        fontSize: 14,
        color: '#666',
        marginTop: 5,
        textAlign: 'right',
    },
    actionButtons: {
        padding: 20,
    },
    button: {
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10,
    },
    confirmButton: {
        backgroundColor: '#3d0c45',
    },
    declineButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#dc3545',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    declineButtonText: {
        color: '#dc3545',
    }
});

export default MatchDetailsScreen;