import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Image
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const TipsScreen = ({ navigation }) => {
  const tips = [
    {
      id: '1',
      title: 'How to increase chances of finding your item',
      icon: 'bulb-outline',
      content: 'Provide as many details as possible when reporting a lost item, including photos, location, and time. The more information you provide, the easier it will be for someone to identify your item if they find it.',
      image: require('../assets/logo.jpeg')
    },
    {
      id: '2',
      title: 'Secure your valuables',
      icon: 'lock-closed-outline',
      content: 'Always keep your valuables secure. Use bags with zippers, keep your phone in your front pocket, and be mindful of your belongings in crowded places. Consider using tracking devices for important items.',
    },
    {
      id: '3',
      title: 'What to do immediately after losing an item',
      icon: 'time-outline',
      content: 'Retrace your steps and check all possible locations. Contact places you visited recently. Report the loss on this app immediately. For valuable items like phones or wallets, consider contacting the police.',
    },
    {
      id: '4',
      title: 'How to properly report a found item',
      icon: 'checkmark-circle-outline',
      content: 'Take clear photos of the item without revealing identifying details. Note the exact location where you found it. Store the item safely until it can be returned to its owner. Don\'t share sensitive information publicly.',
    },
    {
      id: '5',
      title: 'Verifying ownership',
      icon: 'shield-checkmark-outline',
      content: 'When someone claims to be the owner of an item you found, ask them to describe specific details about the item that weren\'t mentioned in your post. For valuable items, consider meeting in a public place or at a police station.',
    },
  ];

  const renderTipCard = (tip) => (
    <View key={tip.id} style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconContainer}>
          <Icon name={tip.icon} size={24} color="#3d0c45" />
        </View>
        <Text style={styles.tipTitle}>{tip.title}</Text>
      </View>
      <Text style={styles.tipContent}>{tip.content}</Text>
      {tip.image && (
        <Image source={tip.image} style={styles.tipImage} resizeMode="cover" />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tips & Advice</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Icon name="information-circle-outline" size={48} color="#3d0c45" />
          <Text style={styles.introTitle}>Helpful Tips</Text>
          <Text style={styles.introText}>
            Follow these tips to increase your chances of recovering lost items or helping others find theirs.
          </Text>
        </View>

        <View style={styles.tipsContainer}>
          {tips.map(tip => renderTipCard(tip))}
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Need More Help?</Text>
          <Text style={styles.contactText}>
            If you have any questions or need assistance with the app, feel free to contact our support team.
          </Text>
          <TouchableOpacity style={styles.contactButton}>
            <Icon name="mail-outline" size={20} color="#fff" style={styles.contactButtonIcon} />
            <Text style={styles.contactButtonText}>Contact Support</Text>
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
    paddingTop: STATUSBAR_HEIGHT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3d0c45',
    paddingVertical: 16,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  introSection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  introTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  introText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  tipsContainer: {
    padding: 16,
  },
  tipCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0e6f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  tipContent: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  tipImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 16,
  },
  contactSection: {
    padding: 24,
    backgroundColor: '#f0e6f2',
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3d0c45',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3d0c45',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  contactButtonIcon: {
    marginRight: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TipsScreen; 