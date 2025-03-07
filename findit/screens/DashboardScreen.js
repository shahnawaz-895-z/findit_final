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
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  
  useEffect(() => {
    // Simulate loading data from API
    const fetchData = async () => {
      try {
        setLoading(true);
        // In a real app, you would fetch this data from your backend
        // For now, we'll use demo data
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Demo data
        setStats({
          lostItems: 12,
          foundItems: 8,
          returnedItems: 5,
          pendingItems: 15,
          totalMatches: 7
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Simulated data for charts
  const monthlyData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        data: [20, 45, 28, 80, 99, 43],
        color: (opacity = 1) => `rgba(61, 12, 69, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ["Lost Items Reported"]
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
          navigation.navigate('MatchesScreen');
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
        <View style={{ width: 40 }} />
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
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('MatchesScreen')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#9d5ca3' }]}>
                  <Icon name="git-compare-outline" size={24} color="#fff" />
                </View>
                <Text style={styles.actionText}>View Matches</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => navigation.navigate('ActivityListScreen')}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#d3afd7' }]}>
                  <Icon name="list-outline" size={24} color="#fff" />
                </View>
                <Text style={styles.actionText}>Activity</Text>
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