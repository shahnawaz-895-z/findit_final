import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_CONFIG from '../config';

// Get screen dimensions for responsive design
const { width } = Dimensions.get('window');
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const DashboardScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    lostItems: 0,
    foundItems: 0,
    returnedItems: 0,
    pendingItems: 0,
    totalMatches: 0
  });
  const [monthlyData, setMonthlyData] = useState({
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        color: (opacity = 1) => `rgba(61, 12, 69, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ["Activity"]
  });
  
  useEffect(() => {
    fetchDashboardData();
  }, []);
  
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      console.log('Fetching dashboard stats from API...');
      
      // Demo/fallback data if the API fails
      const demoData = {
        status: 'success',
        stats: {
          lostItems: 12,
          foundItems: 8,
          returnedItems: 5,
          pendingItems: 15,
          totalMatches: 7,
          monthlyData: [
            { month: 1, lost: 3, found: 2, matches: 1 },
            { month: 2, lost: 5, found: 3, matches: 2 },
            { month: 3, lost: 4, found: 2, matches: 1 },
            { month: 4, lost: 6, found: 4, matches: 3 },
            { month: 5, lost: 8, found: 5, matches: 4 },
            { month: 6, lost: 7, found: 6, matches: 3 },
            { month: 7, lost: 9, found: 7, matches: 5 },
            { month: 8, lost: 11, found: 8, matches: 6 },
            { month: 9, lost: 10, found: 7, matches: 5 },
            { month: 10, lost: 8, found: 6, matches: 4 },
            { month: 11, lost: 6, found: 4, matches: 3 },
            { month: 12, lost: 4, found: 3, matches: 2 }
          ]
        }
      };
      
      let data;
      try {
        // Make API call to fetch real statistics with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout
        
        const response = await fetch(`${API_CONFIG.API_URL}/api/dashboard/stats`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn('API returned status:', response.status);
          throw new Error(`API returned status ${response.status}`);
        }
        
        data = await response.json();
        console.log('Received dashboard stats:', data);
      } catch (apiError) {
        console.warn('API call failed, using demo data:', apiError.message);
        // Use demo data if the API call fails
        data = demoData;
        // Log demo data being used
        console.log('Using demo/fallback data for dashboard:', demoData.stats);
      }
      
      if (data.status === 'success') {
        setStats({
          lostItems: data.stats.lostItems || 0,
          foundItems: data.stats.foundItems || 0,
          returnedItems: data.stats.returnedItems || 0,
          pendingItems: data.stats.pendingItems || 0,
          totalMatches: data.stats.totalMatches || 0
        });
        
        // Process monthly data for the chart
        if (data.stats.monthlyData && data.stats.monthlyData.length > 0) {
          const lostItemsData = Array(12).fill(0);
          const foundItemsData = Array(12).fill(0);
          const matchesData = Array(12).fill(0);
          
          // Fill in the data from the API response
          data.stats.monthlyData.forEach(monthData => {
            const monthIndex = monthData.month - 1; // Convert to 0-based index
            lostItemsData[monthIndex] = monthData.lost || 0;
            foundItemsData[monthIndex] = monthData.found || 0;
            matchesData[monthIndex] = monthData.matches || 0;
          });
          
          // Calculate total activity (lost + found + matches) for each month
          const totalActivityData = lostItemsData.map((value, index) => 
            value + foundItemsData[index] + matchesData[index]
          );
          
          setMonthlyData({
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            datasets: [
              {
                data: totalActivityData,
                color: (opacity = 1) => `rgba(61, 12, 69, ${opacity})`,
                strokeWidth: 2
              }
            ],
            legend: ["Total Activity"]
          });
        }
      } else {
        console.error('Error in API response:', data.message);
        // Only show error alert if not using demo data
        if (data !== demoData) {
          Alert.alert('Error', 'Failed to load dashboard data');
        }
        
        // Set some fallback data
        setStats({
          lostItems: 0,
          foundItems: 0,
          returnedItems: 0,
          pendingItems: 0,
          totalMatches: 0
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
      
      // Set some fallback data
      setStats({
        lostItems: 0,
        foundItems: 0,
        returnedItems: 0,
        pendingItems: 0,
        totalMatches: 0
      });
    } finally {
      setLoading(false);
    }
  };
  
  const pieChartData = [
    {
      name: "Lost",
      population: stats.lostItems,
      color: "#3d0c45",
      legendFontColor: "#7F7F7F",
      legendFontSize: 12
    },
    {
      name: "Found",
      population: stats.foundItems,
      color: "#6b2d72",
      legendFontColor: "#7F7F7F",
      legendFontSize: 12
    },
    {
      name: "Returned",
      population: stats.returnedItems,
      color: "#9d5ca3",
      legendFontColor: "#7F7F7F",
      legendFontSize: 12
    },
    {
      name: "Pending",
      population: stats.pendingItems,
      color: "#d3afd7",
      legendFontColor: "#7F7F7F",
      legendFontSize: 12
    }
  ];
  
  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    color: (opacity = 1) => `rgba(61, 12, 69, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false
  };
  
  // Custom StatusBar component to ensure visibility
  const CustomStatusBar = ({backgroundColor, ...props}) => (
    <View style={[styles.statusBar, { backgroundColor }]}>
      <StatusBar translucent backgroundColor={backgroundColor} {...props} />
    </View>
  );
  
  // Stat card component
  const StatCard = ({ title, value, icon, color }) => (
    <TouchableOpacity 
      style={styles.statCard}
      onPress={() => {
        if (title === 'Lost Items') {
          navigation.navigate('ActivityListScreen', { filter: 'lost' });
        } else if (title === 'Found Items') {
          navigation.navigate('ActivityListScreen', { filter: 'found' });
        } else if (title === 'Matches') {
          navigation.navigate('MatchingScreen');
        } else if (title === 'Returned Items') {
          navigation.navigate('ReturnedItemsScreen');
        }
      }}
    >
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        <Icon name={icon} size={24} color="#fff" />
      </View>
      <View style={styles.statInfo}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
  
  return (
    <View style={styles.container}>
      <CustomStatusBar backgroundColor="#3d0c45" barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <TouchableOpacity onPress={fetchDashboardData} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3d0c45" />
          <Text style={styles.loadingText}>Loading dashboard data...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.statsContainer}>
            <StatCard 
              title="Lost Items" 
              value={stats.lostItems} 
              icon="search-outline" 
              color="#3d0c45" 
            />
            <StatCard 
              title="Found Items" 
              value={stats.foundItems} 
              icon="checkmark-circle-outline" 
              color="#6b2d72" 
            />
            <StatCard 
              title="Matches" 
              value={stats.totalMatches} 
              icon="git-compare-outline" 
              color="#9d5ca3" 
            />
            <StatCard 
              title="Returned Items" 
              value={stats.returnedItems} 
              icon="checkbox-outline" 
              color="#28a745" 
            />
          </View>
          
          <View style={styles.chartContainer}>
            <Text style={styles.sectionTitle}>Items Overview</Text>
            <PieChart
              data={pieChartData}
              width={width - 32}
              height={220}
              chartConfig={chartConfig}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              center={[10, 0]}
              absolute
            />
          </View>
          
          <View style={styles.chartContainer}>
            <Text style={styles.sectionTitle}>Monthly Activity</Text>
            <LineChart
              data={monthlyData}
              width={width - 32}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>
          
          <View style={styles.actionsContainer}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('ReportLostItem')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#3d0c45' }]}>
                  <Icon name="search-outline" size={24} color="#fff" />
                </View>
                <Text style={styles.actionText}>Report Lost</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('ReportFoundItem')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#6b2d72' }]}>
                  <Icon name="add-circle-outline" size={24} color="#fff" />
                </View>
                <Text style={styles.actionText}>Report Found</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.tipsContainer}>
            <Text style={styles.sectionTitle}>Tips & Advice</Text>
            <TouchableOpacity 
              style={styles.tipCard}
              onPress={() => navigation.navigate('TipsScreen')}
            >
              <Icon name="bulb-outline" size={24} color="#3d0c45" style={styles.tipIcon} />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Increase your chances</Text>
                <Text style={styles.tipText}>
                  Provide detailed information and clear photos to increase your chances of finding your lost items.
                </Text>
              </View>
              <Icon name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingTop: STATUSBAR_HEIGHT + 16,
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
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: '48%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  actionsContainer: {
    padding: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  tipsContainer: {
    padding: 16,
    marginBottom: 16,
  },
  tipCard: {
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
  tipIcon: {
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default DashboardScreen; 