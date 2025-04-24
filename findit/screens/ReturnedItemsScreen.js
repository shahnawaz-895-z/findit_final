import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import API_CONFIG from '../config';

// Get the status bar height for proper padding
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const ReturnedItemsScreen = ({ navigation }) => {
  const [returnedItems, setReturnedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReturnedItems();
  }, []);

  const fetchReturnedItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const url = `${API_CONFIG.API_URL}/returned-items`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error('Failed to fetch returned items');
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setReturnedItems(data.items || []);
      } else {
        setError(data.message || 'Failed to fetch returned items');
      }
    } catch (error) {
      console.error('Error fetching returned items:', error);
      setError('Failed to fetch returned items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReturnedItems();
  };

  const renderItem = ({ item }) => {
    // Safely handle photo data
    const hasPhoto = item.photo && typeof item.photo === 'string' && item.photo.length > 0;
    
    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => {
          Alert.alert(
            'Returned Item Details',
            `This ${item.itemType === 'LostItem' ? 'lost' : 'found'} item was returned on ${formatDate(item.returnedAt)}.\n\nOriginal description: ${item.originalItem.description || 'No description provided.'}`,
            [{ text: 'OK' }]
          );
        }}
      >
        <View style={styles.itemHeader}>
          <Icon
            name={item.itemType === 'LostItem' ? 'alert-circle-check-outline' : 'check-circle-outline'}
            size={24}
            color={item.itemType === 'LostItem' ? '#3d0c45' : '#28a745'}
          />
          <Text style={styles.itemTitle}>{item.itemName}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Returned</Text>
          </View>
        </View>

        <View style={styles.itemContent}>
          {hasPhoto ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${item.photo}` }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.itemImage, styles.noImageContainer]}>
              <Icon name="image-off" size={36} color="#ddd" />
            </View>
          )}

          <View style={styles.itemDetails}>
            <View style={styles.detail}>
              <Icon name="shape-outline" size={16} color="#555" />
              <Text style={styles.detailText}>{item.category}</Text>
            </View>

            <View style={styles.detail}>
              <Icon name="map-marker-outline" size={16} color="#555" />
              <Text style={styles.detailText}>{item.location}</Text>
            </View>

            <View style={styles.detail}>
              <Icon name="calendar-outline" size={16} color="#555" />
              <Text style={styles.detailText}>{formatDate(item.date)}</Text>
            </View>

            <View style={styles.detail}>
              <Icon name="check-circle-outline" size={16} color="#28a745" />
              <Text style={styles.detailText}>
                Returned on {formatDate(item.returnedAt)}
              </Text>
            </View>
          </View>
        </View>
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
    <SafeAreaView style={styles.container}>
      <CustomStatusBar backgroundColor="#3d0c45" barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Returned Items</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3d0c45" />
          <Text style={styles.loaderText}>Loading returned items...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchReturnedItems}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={returnedItems}
          renderItem={renderItem}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Icon name="check-circle-outline" size={64} color="#28a745" />
              <Text style={styles.emptyText}>No returned items found</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  statusBar: {
    height: STATUSBAR_HEIGHT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3d0c45',
    padding: 16,
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
  refreshButton: {
    padding: 8,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3d0c45',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#28a745',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemContent: {
    flexDirection: 'row',
    padding: 16,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  noImageContainer: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default ReturnedItemsScreen; 